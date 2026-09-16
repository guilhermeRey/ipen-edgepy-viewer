# Documentação do EdgePy Viewer

Fonte da documentação pública do EdgePy Viewer, construída com MkDocs Material.

## Conteúdo

- `docs/index.md`: visão geral, escopo e arquitetura.
- `docs/downloads.md`: instalação e builds standalone/hosted.
- `docs/how-to/integrar-django.md`: integração com uma aplicação Django.
- `docs/how-to/usar-pyscript.md`: editor PyScript e agentes locais.
- `sidebars.json`: páginas verificadas pelo gate de documentação.
- `mkdocs.yml`: configuração do site.

## Executar localmente

A partir da raiz do repositório:

```bash
npm run docs:setup
npm run docs:dev
```

Acesse `http://127.0.0.1:8001/`.

## Validar e construir

```bash
npm run docs:test
```

O site estático é gerado em `apps/docs-site/site/`. Esse diretório é um artefato local e não deve ser commitado.

## Publicação

Para um host estático, use:

```text
Build command: npm run docs:setup && npm run docs:build
Output directory: apps/docs-site/site
```

Downloads binários devem ser publicados como GitHub Release assets, não dentro da árvore de documentação.
