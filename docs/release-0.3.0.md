# EdgePy Viewer 0.3.0

## Escopo

Publicação em 28/10/2026, sob Apache-2.0. Esta versão acrescenta a API opcional `beginRectangularRoi()` ao handle público e sua implementação no Cornerstone. Um painel pode calcular histogramas e outras estatísticas a partir da seleção feita diretamente na imagem principal.

- Identidade da imagem e limites inteiros semiabertos em cada seleção.
- Arraste nos dois sentidos, captura de ponteiro e seleção programática por `setRoi()`.
- Contorno alinhado às transformações de zoom, deslocamento e tamanho do viewport.
- Invalidação ao trocar o corte e limpeza por `dispose()`.
- Helper DOM `bindRectangularRoi()` para outros renderizadores.
- Guia de uso em `apps/docs-site/docs/how-to/selecionar-roi.md`.

A operação é opcional, preservando a compatibilidade dos renderizadores existentes. O histograma da trilha institucional é um exemplo de aplicação que consome essa API. Os componentes do exercício são distribuídos pela documentação.

## Métricas

Escopo: TypeScript/TSX de produção em `packages/` e `apps/`, usando as exclusões e os limites existentes. Base de comparação: `d548feb`, medida antes da integração com o mesmo script.

| Métrica | Antes | Depois | Limite |
| --- | ---: | ---: | ---: |
| Arquivos de produção | 107 | 110 | Informativo |
| LOC não vazias | 9.880 | 10.085 | Informativo |
| Funções | 1.162 | 1.189 | Informativo |
| Complexidade ciclomática máxima | 10 | 10 | 10 pelo ESLint |
| Maior função | 140 | 136 | 140 |
| Maior arquivo | 259 | 259 | 260 |

O gate de duplicação mediu 0,67% de linhas duplicadas em seu escopo próprio, abaixo do limite de 5%. Madge não encontrou ciclos. ESLint e SonarJS passaram com os limites existentes, incluindo complexidade cognitiva de até 15 por função.

## Verificação

- `npm ci`: instalação pelo lockfile concluída.
- `npm run typecheck`: aprovado em todos os workspaces.
- `npm run test`: 144 testes aprovados em 41 arquivos, além do build estrito da documentação pública.
- `npm run metrics:check` e `npm run verify-all`: aprovados.
- `npm run build`: builds dos pacotes, aplicação e documentação aprovados.
- `npm run package:hosted`: build IIFE concluído.
- Chromium: integração do painel com o renderer, contagens de uma ROI DICOM comparadas com pydicom/NumPy, transformações da câmera, mudança de janela, redimensionamento e liberação da sessão.

Não foram coletadas cobertura, métricas de desempenho ou testes de interoperabilidade com todos os formatos DICOM.

## Artefato hosted

- Arquivo: `edgepy-viewer-hosted-0.3.0.zip`, anexado à release do GitHub.
- Conteúdo: 17 arquivos, incluindo `clinical-viewer/`, workers, agentes e avisos de licença.
- Tamanho: 3.282.719 bytes.
- SHA-256: `c3b1e5d3b8c8d9417b3f492881b6b7b1e852c9b2965274a02967657a4a87f453`.
- Estrutura obrigatória e integridade ZIP conferidas.

## Dependências e avisos

O lockfile preserva as versões das dependências externas. `npm audit --omit=dev` reportou 12 entradas, sendo 3 altas e 9 moderadas, com saída 1. Há entradas em Cornerstone/VTK, `js-yaml`, `fflate`, `uuid`, `xmlbuilder2` e ferramentas de build/teste declaradas como dependências do workspace. Parte tem correção disponível, enquanto o grafo Cornerstone/VTK ainda contém caminhos sem correção indicada. A auditoria foi registrada separadamente dos gates de código e não foi tratada como aprovada.

Persistem os avisos de externalização de `fs`/`path` dos codecs e de chunks maiores que 500 kB. O site público usa MkDocs Material, que informa sua transição de manutenção. As fontes, PyScript e Pyodide do demo padrão usam serviços externos.

Esta release mantém o caráter preliminar de pesquisa descrito no README.
