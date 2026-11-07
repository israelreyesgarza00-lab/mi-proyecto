class NodoPagina:
    def __init__(self, info):
        self.info = info
        self.izq = None
        self.der = None


class NodoTermino:
    def __init__(self, info):
        self.info = info
        self.izq = None
        self.der = None
        self.paginas = None  # raíz del árbol de páginas


# ---------- Árbol de páginas ----------
def insertar_pagina(raiz, pagina):
    if raiz is None:
        return NodoPagina(pagina)
    if pagina < raiz.info:
        raiz.izq = insertar_pagina(raiz.izq, pagina)
    elif pagina > raiz.info:
        raiz.der = insertar_pagina(raiz.der, pagina)
    # si es igual, no se duplica
    return raiz


def paginas_inorden(raiz, resultado):
    if raiz is not None:
        paginas_inorden(raiz.izq, resultado)
        resultado.append(str(raiz.info))
        paginas_inorden(raiz.der, resultado)


# ---------- Árbol de términos ----------
def buscar_o_insertar_termino(raiz, termino):
    """Devuelve (raiz, nodo) con el nodo del término (existente o nuevo)."""
    if raiz is None:
        nuevo = NodoTermino(termino)
        return nuevo, nuevo
    if termino < raiz.info:
        raiz.izq, nodo = buscar_o_insertar_termino(raiz.izq, termino)
    elif termino > raiz.info:
        raiz.der, nodo = buscar_o_insertar_termino(raiz.der, termino)
    else:
        nodo = raiz
    return raiz, nodo


def imprimir_indice(raiz):
    if raiz is not None:
        imprimir_indice(raiz.izq)
        paginas = []
        paginas_inorden(raiz.paginas, paginas)
        print(f"{raiz.info}: {', '.join(paginas)}")
        imprimir_indice(raiz.der)


# ---------- Captura ----------
def capturar_termino(raiz):
    termino = input("Término principal: ").strip().lower()
    if not termino:
        print("El término no puede estar vacío.")
        return raiz

    while True:
        try:
            n = int(input("¿Cuántos números de página tiene este término? "))
            if n > 0:
                break
            print("Debe ser mayor que 0.")
        except ValueError:
            print("Ingresa un número entero.")

    raiz, nodo = buscar_o_insertar_termino(raiz, termino)

    for i in range(n):
        while True:
            try:
                pag = int(input(f"  Página {i + 1}: "))
                if pag > 0:
                    break
                print("  La página debe ser positiva.")
            except ValueError:
                print("  Ingresa un número entero.")
        nodo.paginas = insertar_pagina(nodo.paginas, pag)

    print("Término capturado.")
    return raiz


# ---------- Programa principal ----------
def main():
    raiz = None
    while True:
        print("\n===== ÍNDICE DE LIBRO =====")
        print("1. Capturar término principal con sus páginas")
        print("2. Imprimir índice en orden alfabético")
        print("3. Salir")
        opcion = input("Elige una opción: ").strip()

        if opcion == "1":
            raiz = capturar_termino(raiz)
        elif opcion == "2":
            if raiz is None:
                print("El índice está vacío.")
            else:
                print("\n--- ÍNDICE ---")
                imprimir_indice(raiz)
        elif opcion == "3":
            print("Fin del programa.")
            break
        else:
            print("Opción no válida.")


if __name__ == "__main__":
    main()