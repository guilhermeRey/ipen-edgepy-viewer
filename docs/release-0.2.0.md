# Publicação preliminar 0.2.0

## Escopo

- Origem funcional: deployment de produção `a253423bf7d84b43b498a5e4acf69d0691a1de57`.
- Linguagens: TypeScript, TSX, Python, CSS e Markdown.
- Aplicação: viewer standalone e build hosted.
- Distribuição: código-fonte público com histórico novo.
- Licença: Apache-2.0.

## Saneamento para publicação

- Dados clínicos e arquivos volumétricos não foram incluídos.
- Screenshots e vídeo derivados de estudos clínicos foram removidos.
- Logos, retratos e outros assets sem autorização de redistribuição documentada foram removidos.
- Fixtures foram substituídas por identificadores explicitamente sintéticos.
- ZIPs gerados foram removidos da árvore de código.
- O script acoplado ao simulador Django do monorepo privado foi removido.

Essas mudanças não alteram o código de runtime do viewer implantado em produção.

## Métricas

| Métrica | Resultado | Limite | Status |
| --- | ---: | ---: | --- |
| Arquivos de produção | 107 | Informativo | OK |
| LOC não vazias | 9.880 | Informativo | OK |
| Funções | 1.162 | Informativo | OK |
| Complexidade ciclomática máxima | 10 | 10 | OK |
| Maior função | 140 linhas | 140 | OK |
| Maior arquivo | 259 LOC | 260 | OK |
| Duplicação | 0,69% | 5% | OK |
| Dependências circulares | 0 | 0 | OK |
| Testes | 142 aprovados | Todos | OK |

## Gates executados

- `npm ci`
- `npm run typecheck`
- `npm run test`
- `npm run metrics:check`
- `npm run verify-all`
- `npm run build`
- `npm run package:hosted`
- `npm run docs:test`

Não foi coletada cobertura de testes; este relatório não faz afirmação de cobertura.

## Dependências

O lockfile recebeu apenas correções compatíveis com os ranges declarados. O `npm audit --omit=dev` ainda reporta 1 vulnerabilidade alta e 6 moderadas em dependências transitivas de Cornerstone/VTK, sem correção disponível no grafo atual. Os advisories envolvem `js-yaml`, `fflate` e `uuid`.

Não foi usado `npm audit fix --force`. O risco deve ser reavaliado quando Cornerstone/VTK publicar versões compatíveis corrigidas.

## Avisos conhecidos

- O Vite externaliza referências Node `fs` e `path` presentes nos codecs Cornerstone para compatibilidade com o navegador.
- Alguns chunks excedem 500 kB após minificação.
- PyScript, Pyodide e fontes são carregados de serviços externos no demo padrão.

## Uso clínico

Esta é uma versão preliminar de pesquisa. Resultados exigem validação humana e não devem ser usados automaticamente para diagnóstico ou decisão clínica.
