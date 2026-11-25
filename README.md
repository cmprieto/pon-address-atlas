# Poncio

Quiero que construyas una aplicación web pensada sobretodo para usar desde el movil. Se llama “Replanteo AI” y sirve para que un técnico de replanteos  de FTTH de la empresa Digi automatice su flujo de trabajo.

El proceso es el siguiente:

La idea es que a partir de unos planos pdf extraer un listado con el nombre de las fincas que están en esas páginas.  Pone un botón para subir el archivo e indicar que paginas son las que hay que tratar.

La información que hay que extraer es:

Nombre del pon y población en la cabecera.

 * un listado en formato texto del nombre de la calle y el numero de finca. Si se repite calle y numero se vuelve a incluir solo si está en el mismo plano. 

	•		•	Si se repiten en dos planos diferentes puede que sean la misma finca, pregúntame si se añade o no.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4865ee7d-0b72-426b-8e39-e1733a09c670).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
