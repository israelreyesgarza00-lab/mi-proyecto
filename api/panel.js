const { createHash, timingSafeEqual } = require('node:crypto')
const { Pool } = require('pg')
const Excel = require('exceljs')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3
})

const digest = value => createHash('sha256').update(value).digest()
const integer = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max
const productId = value => /^\d{1,18}$/.test(String(value))
const text = value =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function today() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Mexico_City'
  }).format(new Date())
}

async function transaction(work, begin = 'BEGIN') {
  const client = await pool.connect()
  try {
    await client.query(begin)
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function weeklyReport(client, week) {
  const sales = await client.query(`
    SELECT s.sold_on::text AS date, p.model, p.flavor, s.units,
           s.unit_price, s.units * s.unit_price AS total
    FROM panel_sales s
    JOIN panel_products p ON p.id = s.product_id
    WHERE s.sold_on >= $1::date AND s.sold_on < $1::date + 7
    ORDER BY s.sold_on DESC, s.id
  `, [week])

  const ranking = await client.query(`
    SELECT min(p.flavor) AS flavor, sum(s.units)::int AS units
    FROM panel_sales s
    JOIN panel_products p ON p.id = s.product_id
    WHERE s.sold_on >= $1::date AND s.sold_on < $1::date + 7
    GROUP BY lower(p.flavor)
    ORDER BY units DESC, flavor
  `, [week])

  return { sales: sales.rows, ranking: ranking.rows }
}

async function sendExcel(res, week, report) {
  const workbook = new Excel.Workbook()
  const sales = workbook.addWorksheet('Ventas')
  sales.columns = [
    { header: 'Fecha', width: 14 },
    { header: 'Modelo', width: 28 },
    { header: 'Sabor', width: 30 },
    { header: 'Unidades', width: 13 },
    { header: 'Precio unitario', width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Importe', width: 18, style: { numFmt: '#,##0.00' } }
  ]
  sales.addRows(report.sales.map(row => [
    row.date, row.model, row.flavor, row.units, Number(row.unit_price), Number(row.total)
  ]))

  const ranking = workbook.addWorksheet('Ranking')
  ranking.columns = [
    { header: 'Sabor', width: 30 },
    { header: 'Unidades vendidas', width: 22 }
  ]
  ranking.addRows(report.ranking.map(row => [row.flavor, row.units]))

  for (const sheet of [sales, ranking]) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.getRow(1).font = { bold: true }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="ventas-semana-${week}.xlsx"`)
  return res.end(Buffer.from(buffer))
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const password = process.env.PANEL_PASSWORD

  if (!password || !process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Faltan las variables del panel en Vercel.' })
  }

  const expected = 'Basic ' + Buffer.from('admin:' + password).toString('base64')
  if (!timingSafeEqual(digest(req.headers.authorization || ''), digest(expected))) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Panel Rega", charset="UTF-8"')
    return res.status(401).json({ error: 'Acceso privado.' })
  }

  const { action, week, days } = req.query

  try {
    if (req.method === 'GET' && ['overview', 'excel'].includes(action)) {
      if (!validDate(week) || new Date(week).getUTCDay() !== 1) {
        return res.status(400).json({ error: 'Selecciona un lunes para el reporte.' })
      }

      const leadTime = Number(days ?? 7)
      if (!integer(leadTime, 1, 90)) {
        return res.status(400).json({ error: 'El plazo debe ser de 1 a 90 días.' })
      }

      const report = await transaction(async client => {
        const result = await weeklyReport(client, week)
        if (action === 'overview') {
          const products = await client.query(`
            SELECT p.id, p.model, p.flavor, p.stock, p.order_quantity,
                   coalesce(sum(s.units), 0)::int AS recent_units,
                   greatest(
                     0, ceil(coalesce(sum(s.units), 0) * $1::numeric / 28) - p.stock
                   )::int AS suggested
            FROM panel_products p
            LEFT JOIN panel_sales s ON s.product_id = p.id
              AND s.sold_on BETWEEN $2::date - 27 AND $2::date
            GROUP BY p.id
            ORDER BY suggested DESC, p.model, p.flavor
          `, [leadTime, today()])
          result.products = products.rows
        }
        return result
      }, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')

      if (action === 'excel') return sendExcel(res, week, report)
      return res.json(report)
    }

    if (req.method !== 'POST' || !req.headers['content-type']?.startsWith('application/json')) {
      return res.status(405).json({ error: 'Operación no disponible.' })
    }

    const { id, product, model, flavor, stock, quantity, date, units, price } = req.body || {}

    if (action === 'product' && text(model) && text(flavor) && integer(stock, 0, 1000000)) {
      await pool.query(
        'INSERT INTO panel_products (model, flavor, stock) VALUES ($1, $2, $3)',
        [model.trim(), flavor.trim(), stock]
      )
      return res.status(201).json({ ok: true })
    }

    if (action === 'stock' && productId(product) && integer(stock, 0, 1000000)) {
      const result = await pool.query(
        'UPDATE panel_products SET stock = $2 WHERE id = $1', [product, stock]
      )
      return result.rowCount
        ? res.json({ ok: true })
        : res.status(404).json({ error: 'Producto no encontrado.' })
    }

    if (action === 'order' && productId(product)
        && (quantity === null || integer(quantity, 0, 1000000))) {
      const result = await pool.query(
        'UPDATE panel_products SET order_quantity = $2 WHERE id = $1',
        [product, quantity]
      )
      return result.rowCount
        ? res.json({ ok: true })
        : res.status(404).json({ error: 'Producto no encontrado.' })
    }

    if (action === 'sale' && productId(product) && validDate(date) && date <= today()
        && integer(units, 1, 1000000)
        && typeof price === 'string' && /^\d{1,10}(\.\d{1,2})?$/.test(price)
        && typeof id === 'string'
        && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
      await transaction(async client => {
        const inserted = await client.query(`
          INSERT INTO panel_sales (id, sold_on, product_id, units, unit_price)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING RETURNING id
        `, [id, date, product, units, price])

        if (inserted.rowCount) {
          const updated = await client.query(`
            UPDATE panel_products SET stock = stock - $2
            WHERE id = $1 AND stock >= $2
          `, [product, units])
          if (!updated.rowCount) throw Object.assign(new Error(), { code: 'LOW_STOCK' })
        }
      })
      return res.status(201).json({ ok: true })
    }

    return res.status(400).json({ error: 'Revisa los datos ingresados.' })
  } catch (error) {
    if (error.code === 'LOW_STOCK') {
      return res.status(409).json({ error: 'Las unidades superan el stock disponible.' })
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ese modelo y sabor ya existen.' })
    }
    if (error.code === '23503') {
      return res.status(404).json({ error: 'Producto no encontrado.' })
    }
    console.error('Error del panel', error.code || error.name)
    return res.status(500).json({ error: 'No se pudo completar la operación.' })
  }
}
