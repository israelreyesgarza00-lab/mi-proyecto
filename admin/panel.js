const byId = id => document.getElementById(id)
const sale = byId('sale')
const report = byId('report')
const delivery = byId('delivery')
const adjust = byId('adjust')
const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN'
})
const today = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Mexico_City'
}).format(new Date())

function monday(value) {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return date.toISOString().slice(0, 10)
}

sale.elements.date.value = today
sale.elements.date.max = today
report.elements.week.value = monday(today)

function message(text, error = false) {
  const status = byId('status')
  status.textContent = text
  status.dataset.error = String(error)
}

async function request(action, body) {
  const query = new URLSearchParams({ action })
  if (!body) {
    query.set('week', monday(report.elements.week.value))
    query.set('days', delivery.elements.days.value)
  }

  const options = body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  } : undefined

  const response = await fetch('/api/panel?' + query, options)
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    throw new Error(data?.error || `No se pudo completar la operación (${response.status}).`)
  }
  return data
}

function renderRows(id, values, emptyText, columns) {
  const body = byId(id)
  body.replaceChildren()

  if (!values.length) {
    const cell = body.insertRow().insertCell()
    cell.colSpan = columns
    cell.textContent = emptyText
    return
  }

  for (const valuesForRow of values) {
    const row = body.insertRow()
    for (const value of valuesForRow) {
      const cell = row.insertCell()
      if (value instanceof HTMLElement) cell.append(value)
      else cell.textContent = value
    }
  }
}

function orderInput(product) {
  const input = document.createElement('input')
  input.type = 'number'
  input.min = '0'
  input.max = '1000000'
  input.step = '1'
  input.setAttribute('aria-label', `Cantidad a pedir de ${product.model} / ${product.flavor}`)

  let saved = product.order_quantity
  input.value = saved ?? product.suggested

  input.addEventListener('change', async () => {
    if (!input.reportValidity()) return
    const quantity = input.value === '' ? null : Number(input.value)
    input.disabled = true

    try {
      await request('order', { product: product.id, quantity })
      saved = quantity
      message(quantity === null ? 'Sugerencia restablecida.' : 'Cantidad a pedir guardada.')
    } catch (error) {
      message(error.message, true)
    } finally {
      input.value = saved ?? product.suggested
      input.disabled = false
    }
  })

  return input
}

let refreshId = 0

async function refresh() {
  if (!report.elements.week.reportValidity() || !delivery.elements.days.reportValidity()) return

  const current = ++refreshId
  const week = monday(report.elements.week.value)
  const data = await request('overview')
  if (current !== refreshId) return

  const download = byId('export')
  download.href = '/api/panel?' + new URLSearchParams({ action: 'excel', week })
  download.hidden = false

  const units = data.sales.reduce((sum, row) => sum + row.units, 0)
  const total = data.sales.reduce((sum, row) => sum + Number(row.total), 0)
  byId('summary').textContent =
    `Semana del ${week} · ${units} unidades · ${currency.format(total)}`

  renderRows('ranking', data.ranking.map(row => [row.flavor, row.units]),
    'Aún no hay ventas en esta semana.', 2)

  renderRows('sales', data.sales.map(row => [
    row.date, row.model, row.flavor, row.units, currency.format(row.total)
  ]), 'Aún no hay ventas en esta semana.', 5)

  renderRows('stock', data.products.map(row => [
    row.model, row.flavor, row.stock, row.recent_units, row.suggested, orderInput(row)
  ]), 'Agrega un producto para empezar.', 6)

  for (const form of [sale, adjust]) {
    const select = form.elements.product
    const previous = select.value
    select.replaceChildren(new Option('Selecciona un producto', ''))

    for (const row of data.products) {
      select.add(new Option(`${row.model} / ${row.flavor}`, row.id))
    }

    if (data.products.some(row => String(row.id) === previous)) {
      select.value = previous
    }

    if (!form.dataset.saving) {
      form.querySelector('button').disabled = !data.products.length
    }
  }
}

for (const form of [report, delivery]) {
  form.addEventListener('submit', async event => {
    event.preventDefault()
    try {
      await refresh()
      message('')
    } catch (error) {
      message(error.message, true)
    }
  })
}

let pendingSale

for (const [form, action, success] of [
  [sale, 'sale', 'Venta guardada.'],
  [byId('product'), 'product', 'Producto agregado.'],
  [adjust, 'stock', 'Existencias actualizadas.']
]) {
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (form.dataset.saving) return

    const button = form.querySelector('button')
    button.disabled = true
    form.dataset.saving = 'true'

    const body = Object.fromEntries(new FormData(form))
    for (const field of ['units', 'stock']) {
      if (field in body) body[field] = Number(body[field])
    }

    if (action === 'sale') {
      const signature = JSON.stringify(body)
      if (pendingSale?.signature !== signature) {
        pendingSale = { signature, id: crypto.randomUUID() }
      }
      body.id = pendingSale.id
    }

    try {
      await request(action, body)
      if (action === 'sale') {
        pendingSale = undefined
        form.elements.units.value = '1'
        report.elements.week.value = monday(body.date)
      }
      if (action === 'product') form.reset()
      message(success)

      try {
        await refresh()
      } catch {
        message(success + ' Recarga el panel para ver los datos actualizados.')
      }
    } catch (error) {
      message(error.message, true)
    } finally {
      delete form.dataset.saving
      button.disabled = false
    }
  })
}

refresh().catch(error => message(error.message, true))
