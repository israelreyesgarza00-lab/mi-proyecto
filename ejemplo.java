public class Primo {
    public static void main(String[] args) {
        int n = 13;
        int rayitas = 0;

        for (int candidato = 2; candidato <= n - 1; candidato++) {
            if (n % candidato == 0) {
                rayitas = rayitas + 1;
            }
        }

        if (rayitas == 0) {
            System.out.println("es primo");
        } else {
            System.out.println("no es primo");
        }
    }
}