# Obter e construir

O código-fonte do EdgePy Viewer está disponível no GitHub sob Apache License 2.0:

```bash
git clone https://github.com/guilhermeRey/ipen-edgepy-viewer.git
cd ipen-edgepy-viewer
git checkout v0.3.0
npm ci
```

## Aplicação de demonstração

```bash
npm run dev
```

O servidor local informa a URL de acesso, normalmente `http://localhost:5173`.

## Build de produção

```bash
npm run build
```

O build standalone fica em `apps/viewer-demo/dist/`.

## Build hosted

O pacote pronto da v0.3.0 está nos [assets da release](https://github.com/guilhermeRey/ipen-edgepy-viewer/releases/tag/v0.3.0), acompanhado de `SHA256SUMS` e avisos de licença.

Para integrar o viewer a Django ou outro host web:

```bash
npm run package:hosted
```

O comando gera:

```text
apps/viewer-demo/dist-hosted/clinical-viewer/
  edgepy-viewer-hosted.iife.js
  edgepy-viewer-hosted.css
  assets/
  agents/
    manifest.json
    pyscript_worker.py
    pycom_agent.py
    viewer_context_summary.py
    dose_statistics.py
```

Copie `clinical-viewer/` para o static root da aplicação host. Se precisar de um ZIP para transporte interno:

```bash
cd apps/viewer-demo/dist-hosted
zip -r edgepy-viewer-hosted-0.3.0.zip clinical-viewer
```

Antes de redistribuir um binário, inclua `LICENSE`, `NOTICE`, os avisos de terceiros aplicáveis e um checksum SHA-256.

## Verificação

```bash
npm run typecheck
npm run test
npm run metrics:check
npm run verify-all
npm run build
npm run docs:setup
npm run docs:test
```

Os ZIPs são distribuídos como assets do GitHub Release, acompanhados de checksum e documentação de licença.
