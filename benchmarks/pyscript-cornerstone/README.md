# Reprodução da leitura DICOM — PyScript × Cornerstone

Este pacote repete o procedimento quantitativo utilizado na dissertação do EdgePy Viewer. Baixa uma série pública de objeto simulador, verifica os arquivos e os pixels, executa os dois caminhos no navegador e produz novos tempos, tabelas e gráficos. Usa o adaptador de decodificação de `packages/renderer-cornerstone` deste repositório.

## Execução

Pré-requisitos: **Python 3.11**, **Node.js 22.12 ou superior com npm**, **Google Chrome ou Chromium** instalado e acesso à internet. Não exige conta no TCIA, dados clínicos locais nem o repositório privado de desenvolvimento. A primeira execução baixa aproximadamente 23 MB de imagens compactadas, além das dependências Python, JavaScript e WebAssembly.

Na raiz de uma cópia deste repositório que contenha o pacote:

```sh
python3.11 benchmarks/pyscript-cornerstone/reproduce.py
```

No Windows, o comando equivalente é `py -3.11 benchmarks/pyscript-cornerstone/reproduce.py`. A validação inicial deste pacote foi realizada no macOS; as outras plataformas exigem conferência no ambiente de destino.

O script instala dependências em `.venv/` e `node_modules/` **dentro do pacote**, obtém e verifica os dados, gera a referência, constrói a página do teste e inicia um servidor local em porta livre. Executa o Chrome em perfil temporário separado, fecha o navegador e encerra o servidor ao terminar. A instalação da aplicação inteira e a abertura de outro terminal são desnecessárias.

Para indicar outro executável:

```sh
python3.11 benchmarks/pyscript-cornerstone/reproduce.py --chrome "/caminho/para/chrome"
```

Também é aceita a variável `CHROME_PATH`. Para verificar a instalação com quatro execuções curtas (duas sintéticas e um par preparatório de 32 imagens):

```sh
python3.11 benchmarks/pyscript-cornerstone/reproduce.py --smoke
```

Esse modo não produz uma comparação final. Depois da instalação, `--skip-install` permite reutilizar as dependências; os arquivos DICOM continuam sendo verificados. Uma nova coleta deve ser feita com a máquina ociosa e as condições de energia registradas.

## Dados e verificações

- **Coleção:** Credence Cartridge Radiomics Phantom CT Scans (CC-Radiomics-Phantom), TCIA, versão 1, de 28/07/2017.
- **Citação:** Mackin et al. (2017). *Data From Credence Cartridge Radiomics Phantom CT Scans*. [DOI 10.7937/K9/TCIA.2017.zuzrml5b](https://doi.org/10.7937/K9/TCIA.2017.zuzrml5b).
- **Licença dos dados:** [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), distinta da licença Apache-2.0 do código.
- **Série:** `1.3.6.1.4.1.14519.5.2.1.4020.5263.137125892409456229662234563386`, objeto simulador `CCR1_P2`.
- **Entradas:** 123 imagens CT, MONOCHROME2, não comprimidas, de 512 × 512 pixels; subconjuntos de 32 e 123 imagens em ordem geométrica.

O download é feito pela API pública NBIA/TCIA. Cada DICOM deve coincidir byte a byte com seu SHA-256 em `manifests/dataset.json`; diferenças interrompem a preparação. O contêiner ZIP pode receber metadados diferentes do serviço, por isso seu hash é registrado, mas a identidade do corpus é decidida pelos 123 arquivos internos.

`scripts/reference.py` compara o pydicom offline com a interpretação manual das palavras de pixels, incluindo sinal e máscara de bits, e reconfere os resultados contra `manifests/reference.json`. Duas imagens sintéticas 4 × 4 exercitam valores sem sinal, sinal em 12 bits e transformação de intensidade. Os manifestos históricos são imutáveis; downloads, fixtures e a referência recalculada ficam em `data/`.

Em cada execução do navegador, são confrontados identificadores, dimensões, hashes de todos os pixels e das imagens RGBA com a referência. Falhas são preservadas no diretório da tentativa e fazem o processo terminar com erro, sem publicar uma síntese de sucesso.

## Protocolo preservado

São **28 execuções**: duas verificações sintéticas, seis preparatórias e **vinte medidas**, correspondentes a cinco pares por carga. A ordem utiliza a semente `20260923`, a mesma da coleta histórica. Cada execução abre uma página nova, mantendo os caches HTTP e do sistema operacional conforme o uso normal do processo.

O resultado principal é `decode_all_ms`: leitura sequencial dos arquivos até a disponibilização dos pixels da série. O download e a criação dos objetos `File` antecedem a medição. O interpretador Python e seus pacotes já estão inicializados. No caminho Cornerstone, a primeira leitura pode incluir a inicialização do worker. O navegador usa modo headless, GPU desativada, viewport 1200 × 900 e DPR 1.

Para preservar a sequência original, o teste também executa o desenho inicial e as operações posteriores de navegação/janela em Canvas comum. Seus registros permanecem em `runs.json`; o resumo e o gráfico publicados por este pacote selecionam apenas a leitura/decodificação. A transformação JavaScript do teste não é o renderizador nativo Cornerstone.

As versões científicas estão fixadas: PyScript 2025.2.4; Pyodide 0.27.2; pydicom 3.0.1; NumPy 2.0.2 no navegador; Cornerstone core/loader 4.22.13; Vite 7.3.3. A referência offline usa Python 3.11, pydicom 3.0.1 e NumPy 1.26.4. As dependências JavaScript têm lockfile próprio; as dependências Python estão em `requirements.txt`.

Essas versões reproduzem o teste histórico, mesmo quando o PyScript Lab da aplicação utiliza um runtime mais recente. As versões efetivas do navegador, sistema operacional e interpretadores são registradas na nova coleta.

## Resultados e rastreabilidade

Cada tentativa recebe uma pasta nova em `results/`, identificada pela data/hora UTC. Os dados e resultados gerados não são versionados automaticamente.

| Arquivo | Conteúdo |
|---|---|
| `runs.json` e JSON por execução | Tempos brutos, verificações, falhas e versões dos runtimes. |
| `schedule.json` | Ordem das execuções e semente. |
| `environment.json` | Máquina, SO, navegador, flags, versão Node e commit-base. |
| `source-hashes.json` | SHA-256 de código, build, dependências fixadas, aquisição e referências. Identifica também código ainda não commitado. |
| `measurements.csv` | Os vinte tempos individuais de leitura/decodificação. |
| `summary.json` | Medianas, extremos e razões calculadas dentro de cada par. |
| `leitura-dicom.png` e `.svg` | Gráfico da nova coleta. |
| `report.md` | Síntese legível e delimitação do resultado. |

Para refazer somente a análise de uma coleta completa, sem novas medições:

```sh
benchmarks/pyscript-cornerstone/.venv/bin/python \
  benchmarks/pyscript-cornerstone/scripts/analyze.py \
  benchmarks/pyscript-cornerstone/results/DIRETORIO_DA_COLETA
```

A análise exige todos os pares válidos; não descarta silenciosamente falhas ou execuções lentas. O script aceita também o formato das observações históricas completas, mas os arquivos da dissertação permanecem sob sua própria preservação.

**Reproduzir o procedimento gera novos tempos.** Não se espera igualdade numérica com setembro de 2026: hardware, versão do Chrome, carga do sistema e condições de execução afetam o resultado. Os gráficos novos não substituem automaticamente a Figura 5.6 da dissertação. Cinco repetições técnicas não são cinco pacientes nem uma avaliação clínica de fluidez.

## Verificação do código

```sh
benchmarks/pyscript-cornerstone/.venv/bin/python -m unittest discover \
  -s benchmarks/pyscript-cornerstone/scripts -p 'test_*.py' -v
```

Os testes verificam a recusa de coletas incompletas, pares duplicados, falhas de correção e intervalos de tempo inconsistentes. A prova de integração é a execução completa acima, incluindo o download e as validações no navegador.

Consulte [PROVENANCE.md](PROVENANCE.md) para a origem do código e as adaptações de empacotamento.
