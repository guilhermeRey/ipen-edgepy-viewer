# Contributing

Obrigado por contribuir com o EdgePy Viewer.

## Arquitetura

- Mantenha `packages/core` livre de React, DOM, browser, Cornerstone, PyScript, Pyodide, pixels e voxels.
- Coloque integração externa em portas e adapters.
- Preserve a direção de dependências entre domínio, aplicação e infraestrutura.
- Não adicione compatibilidade retroativa sem contrato externo ou dado persistido que a justifique.

## Verificação

Antes de abrir um pull request:

```bash
npm ci
npm run typecheck
npm run test
npm run metrics:check
npm run verify-all
npm run build
npm run docs:setup
npm run docs:test
```

## Dados clínicos

Não commite dados de pacientes, identificadores DICOM reais, arquivos volumétricos, screenshots derivados de pacientes ou datasets restritos. Use somente valores sintéticos ou amostras com redistribuição documentada.

Leia `docs/data-policy.md` antes de adicionar fixtures ou mídia.

## Pull requests

- Explique a mudança de comportamento e a motivação.
- Identifique os pacotes e limites arquiteturais afetados.
- Inclua testes ou explique por que não se aplicam.
- Informe riscos clínicos, de privacidade, segurança e interoperabilidade.
- Não reduza thresholds nem amplie exclusões apenas para fazer gates passarem.

Ao contribuir, você concorda que sua contribuição será licenciada sob Apache License 2.0, conforme a seção 5 da licença.
