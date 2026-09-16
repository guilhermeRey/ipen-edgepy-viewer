# EdgePy Viewer

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Visualizador web React/TypeScript para estudos DICOM, SPECT/PET, CT, máscaras, RTSTRUCT e mapas de dose MHD/RAW, com processamento Python local por PyScript/Pyodide.

Este repositório apresenta uma versão preliminar do software desenvolvido no contexto do Mestrado Profissional em Tecnologia das Radiações em Ciências da Saúde do IPEN. A aplicação é experimental e não deve ser usada automaticamente para diagnóstico ou decisão clínica.

## Versão publicada

Esta primeira publicação pública foi extraída da versão implantada em [app.edgepy.dev](https://app.edgepy.dev), correspondente ao commit `a253423bf7d84b43b498a5e4acf69d0691a1de57` do repositório de desenvolvimento original.

O código funcional do viewer foi preservado. A distribuição pública usa histórico novo e exclui dados clínicos, mídia derivada de pacientes, artefatos internos e binários gerados sem documentação de redistribuição.

## Recursos

- Importação local de estudos DICOM e arquivos `.IMA`.
- Renderização de CT e imagens funcionais com Cornerstone.
- Máscaras, contornos RTSTRUCT e overlays de dose MHD/RAW.
- Integração hosted para aplicações Django ou outros hosts web.
- Painel de agentes Python executados no navegador.
- PyScript Lab com editor, exemplos, controle de worker e overlay 2D temporário.
- Layouts lateral, inferior e tela cheia para o editor.
- Processamento de pixels e voxels no cliente, sem backend Python obrigatório.

## Arquitetura

```text
apps/
  viewer-demo/          aplicação Vite/React e entrada hosted
  docs-site/            documentação MkDocs
packages/
  core/                 domínio clínico e casos de uso puros
  worker-runtime/       contratos de execução em Web Workers
  dicom/                leitura, inventário e adaptação DICOM
  renderer-cornerstone/ adapter de renderização Cornerstone
  react-viewer/         composição React do viewer
  design-system/        estilos e tokens visuais
  pyodide-agents/       runtime PyScript/Pyodide e agentes
  host-integration/     contratos para hosts e Django
```

`packages/core` deve permanecer independente de React, DOM, browser, Cornerstone, PyScript, Pyodide, pixels e voxels. Integrações externas entram por portas e adapters.

## Requisitos

- Node.js 24 ou compatível.
- npm 10 ou compatível.
- Python 3 para construir a documentação MkDocs.
- Navegador moderno com Web Workers e WebAssembly.

## Executar localmente

```bash
npm ci
npm run dev
```

Abra `http://localhost:5173`.

## Qualidade e testes

```bash
npm run typecheck
npm run test
npm run metrics:check
npm run verify-all
npm run build
```

`verify-all` executa lint, detecção de dependências circulares e orçamento de duplicação. Os limites de métricas ficam em `software-metrics.config.json` e `.jscpd.json`.

## Build hosted

```bash
npm run package:hosted
```

Os assets estáticos são gerados em:

```text
apps/viewer-demo/dist-hosted/clinical-viewer/
```

Copie essa pasta para o static root do sistema host. O build inclui o bundle IIFE, CSS, workers e agentes Python. Consulte [Como integrar com Django](apps/docs-site/docs/how-to/integrar-django.md).

## PyScript Lab

O painel `Agents` executa Python localmente com PyScript 2026.7.2 e Pyodide 0.28.3. O editor recebe o contexto do estudo, o slice ativo e, mediante opção explícita, o volume de dose visível.

Consulte [Como usar o editor PyScript](apps/docs-site/docs/how-to/usar-pyscript.md) para os objetos disponíveis, exemplos e requisitos de CSP.

## Documentação

```bash
npm run docs:setup
npm run docs:dev
```

A documentação fica em `apps/docs-site/docs/`. Para validar o build estático:

```bash
npm run docs:test
```

## Dados clínicos e privacidade

Dados DICOM, identificadores, mapas de dose, máscaras, screenshots e datasets derivados de pacientes não fazem parte deste repositório nem da licença do código, salvo declaração escrita específica.

Leia a [política de dados](docs/data-policy.md) antes de contribuir. Exemplos e testes públicos devem usar somente dados sintéticos ou explicitamente redistribuíveis.

O modo padrão usa recursos externos para fontes, PyScript e Pyodide. Instalações com requisitos estritos de privacidade devem hospedar esses recursos em origem controlada e revisar CSP, telemetria de rede e logs do navegador.

## Segurança

Não publique vulnerabilidades ou dados clínicos em issues públicas. Consulte [SECURITY.md](SECURITY.md).

## Licença

O código-fonte e a documentação autoral deste repositório são disponibilizados sob a [Apache License 2.0](LICENSE). Veja também [NOTICE](NOTICE) e [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

A licença não concede direitos sobre marcas e não cobre datasets clínicos ou conteúdo de terceiros sem indicação expressa.

## Autoria

Desenvolvido por Guilherme Policicio Rey no contexto do Mestrado Profissional em Tecnologia das Radiações em Ciências da Saúde do IPEN, sob orientação do Prof. Dr. Orlando Rodrigues Junior.
