class Nodo:
    def __init__(self):
        self.hijos = [None] * 10   # un hijo por cada dígito 0-9
        self.datos = None          # (descripcion, unidad) si aquí termina un producto
 
 
class BosqueDigital:
    def __init__(self):
        self.raices = [None] * 10  # el bosque: una raíz por primer dígito
 
    def insertar(self, numero, descripcion, unidad):
        """Inserta el producto. Devuelve True si es nuevo, False si ya existía (se actualiza)."""
        primero = int(numero[0])
        if self.raices[primero] is None:
            self.raices[primero] = Nodo()
        actual = self.raices[primero]
 
        for d in numero[1:]:
            i = int(d)
            if actual.hijos[i] is None:
                actual.hijos[i] = Nodo()
            actual = actual.hijos[i]
 
        es_nuevo = actual.datos is None
        actual.datos = (descripcion, unidad)
        return es_nuevo
 
    def buscar(self, numero):
        """Devuelve (descripcion, unidad) o None si no existe."""
        actual = self.raices[int(numero[0])]
        for d in numero[1:]:
            if actual is None:
                return None
            actual = actual.hijos[int(d)]
        return actual.datos if actual else None
 
    def listar(self):
        """Recorre todo el bosque y devuelve [(numero, descripcion, unidad), ...]."""
        resultado = []
 
        def recorrer(nodo, prefijo):
            if nodo is None:
                return
            if nodo.datos:
                resultado.append((prefijo, *nodo.datos))
            for i in range(10):
                recorrer(nodo.hijos[i], prefijo + str(i))
 
        for i in range(10):
            recorrer(self.raices[i], str(i))
        return resultado
 
 
def pedir_numero():
    while True:
        numero = input("Número de producto (solo dígitos): ").strip()
        if numero.isdigit():
            return numero
        print("  ⚠ Entrada inválida: escribe únicamente números enteros.")
 
 
def pedir_texto(mensaje):
    while True:
        texto = input(mensaje).strip()
        if texto:
            return texto
        print("  ⚠ No puede estar vacío.")
 
 
def mostrar(numero, descripcion, unidad):
    print(f"  Producto:    {numero}")
    print(f"  Descripción: {descripcion}")
    print(f"  Unidad:      {unidad}")
 
 
def main():
    bosque = BosqueDigital()
 
    while True:
        print("\n===== CATÁLOGO DE PRODUCTOS =====")
        print("1. Insertar producto")
        print("2. Buscar producto")
        print("3. Mostrar todos los productos")
        print("4. Salir")
        opcion = input("Elige una opción: ").strip()
 
        if opcion == "1":
            numero = pedir_numero()
            existente = bosque.buscar(numero)
            if existente:
                print("  Ya existe este producto:")
                mostrar(numero, *existente)
                if input("  ¿Actualizar sus datos? (s/n): ").strip().lower() != "s":
                    continue
            descripcion = pedir_texto("Descripción: ")
            unidad = pedir_texto("Unidad de medida (pieza, kg, litros...): ")
            nuevo = bosque.insertar(numero, descripcion, unidad)
            print("  ✔ Producto insertado." if nuevo else "  ✔ Producto actualizado.")
 
        elif opcion == "2":
            numero = pedir_numero()
            datos = bosque.buscar(numero)
            if datos:
                print("  ✔ Producto encontrado:")
                mostrar(numero, *datos)
            else:
                print("  ✘ Producto no encontrado.")
 
        elif opcion == "3":
            productos = bosque.listar()
            if not productos:
                print("  (El bosque está vacío)")
            for numero, descripcion, unidad in productos:
                print(f"  {numero:<12} {descripcion:<30} {unidad}")
 
        elif opcion == "4":
            print("¡Hasta luego!")
            break
        else:
            print("  ⚠ Opción no válida.")
 
 
if __name__ == "__main__":
    main()
 