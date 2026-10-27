# Procedência do pacote

O teste foi extraído das fontes preservadas da coleta de 23/09/2026, arquivadas em `dissertacao/evidencias/fontes-benchmark.tar.gz` no projeto da dissertação. O commit-base do repositório original de desenvolvimento é `6e78a8861c67322f6c45e1448e9e54115a56523c`; o arquivo preservado e seus hashes identificam a instrumentação que ainda não estava commitada naquele marco.

O produto público utilizado na preparação corresponde a `b28648a1d4c8da75dd3bd7acac2f8af0d15b63a9`, versão 0.2.0. Seus módulos `decodeWorkerRegistration.ts` e `uncompressedDecodeWorker.ts` são idênticos aos preservados da coleta. São importados diretamente de `packages/renderer-cornerstone/src`, sem cópia de uma implementação alternativa.

## Arquivos preservados byte a byte

| Caminho neste pacote ou no produto | SHA-256 |
|---|---|
| `manifests/dataset.json` | `93cfd15b95f7b26e824c70538654522761ef35094a636ef1f1978f880fc53a42` |
| `manifests/reference.json` | `8821607ef5ef51645febd134065ce5a2332e0c5bdb2f9c756261ab0785c2a503` |
| `web/public/python.py` | `33da4aaa15147e83cf9b7e7c1515d56eea906045ba8c37fafa31ef88150b1d60` |
| `web/public/window_level.py` | `5a0274c8b417ab8f0e7ec5ec822e9d9374a042c6ce440e3bee5bee2e8df162ab` |
| `web/public/rgba_slice_mapper.py` | `caa9d87f583c97ea7cd227c5a47b442fcc67b05f1bc7d173923d1400c121d270` |
| `packages/renderer-cornerstone/src/decodeWorkerRegistration.ts` | `61767025a21d0b53804c873c946beabdd95516fbf979d81ee8ec971aee234aba` |
| `packages/renderer-cornerstone/src/uncompressedDecodeWorker.ts` | `657df7467d4a531630c6202a9a4bcc099becf1222b5de555a6892ce64773b1b0` |

Os dois módulos Python auxiliares vieram de `ipen/pycom/usecases/window_level.py` e `ipen/pycom/adapters/rgba_slice_mapper.py`. Permanecem como fontes locais para evitar dependência do monorepo original. O código autoral segue a licença Apache-2.0 do projeto; os dados públicos seguem CC BY 3.0, com atribuição no README e no manifesto.

## Adaptações

- Dependências e lockfile próprios; aliases Vite apontam para a instalação do pacote.
- Caminhos de importação/arquivos adaptados à estrutura pública. NumPy do navegador explicitamente fixado em 2.0.2, correspondente ao runtime histórico.
- `web/main.js` preserva as operações medidas e a sequência de medição/validação. Alterações: caminhos, declaração dos globais, laço de espera anterior à medição e remoção de parâmetro sem uso na validação. SHA-256 do arquivo histórico: `97f2042c8a5ab70e91e722bfb1a11985ce43d19526fbba14fd81b480918e90cb`.
- Aquisição verifica o manifesto congelado, sem regravá-lo. Referência offline recalculada é comparada com a original e gravada em `data/`.
- Runner recebe endereço local e diretório de saída, separa espera/validação em funções e falha também quando uma execução medida é inválida. A ordem dos 28 casos foi preservada.
- Chrome é localizado nas instalações usuais ou por `CHROME_PATH`; o perfil temporário é removido após a execução.
- `reproduce.py` reúne instalação, download, referência, build, servidor, coleta e análise em um comando.
- `analyze.py` foi adaptado da análise de leitura da dissertação: admite coletas novas completas e dimensiona o eixo pelo máximo observado. Não contém datas, características de máquina ou conclusões fixadas na rodada histórica.

A identificação do protocolo portátil é `0.2-controlled-B-portable-1`. Uma nova coleta registra seus próprios hashes, ambiente e tempos; não é apresentada como reexecução no navegador histórico de setembro.

## Validação da distribuição — 27/10/2026

O comando `python3.11 benchmarks/pyscript-cornerstone/reproduce.py` foi executado em uma cópia limpa do repositório acrescida deste pacote, sem dependências instaladas na raiz e sem dados previamente baixados. A instalação isolada, o download do TCIA, a referência offline, o build, as 28 execuções e a geração de CSV/JSON/PNG/SVG/Markdown terminaram com sucesso. Todos os casos passaram nas verificações de pixels; a ordem coincide com a coleta histórica.

- Identificador: `20261027T054235.693206Z-collection`.
- Ambiente: Apple M1 Pro, 16 GiB, macOS 26.6.2, Chrome 156.0.8078.48, Node 25.7.0, Python offline 3.11.7, alimentação externa.
- SHA-256 de `runs.json`: `4b6320ce7aaee1e92598338e5fff658a073a6d8b56413d7220baf18309693e47`.
- Seis testes do contrato de análise e `npm run lint` do repositório aprovados.

Uma tentativa anterior foi interrompida pelo limite de tempo da ferramenta do agente, após nove casos. A análise recusou esse conjunto incompleto; os registros foram conservados em diretório próprio. A validação acima corresponde à execução completa reiniciada, sem seleção de casos da tentativa anterior.

Os registros locais ficam em `results/`, ignorado pelo Git. Uma cópia compactada da validação completa foi preservada no projeto da dissertação, em `dissertacao/docs/20261027-reproducao-desempenho/coleta-verificacao.tar.gz`.
