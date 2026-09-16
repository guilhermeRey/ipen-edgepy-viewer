# Como usar o editor PyScript

O painel `Agents` inclui o `PyScript Lab`, um workspace local com editor Python e agentes executados no navegador. Nenhum pixel ou voxel precisa ser enviado a um backend para executar os exemplos.

## Arquitetura

O EdgePy Viewer usa **PyScript** como camada de integração entre a aplicação web e o Python. O release oficial do PyScript cria um `PyWorker` sob demanda e carrega o bootstrap `agents/pyscript_worker.py` publicado junto com o viewer.

O **Pyodide** é o interpretador CPython/WebAssembly usado pelo PyScript nesse worker. Portanto, PyScript e Pyodide têm papéis diferentes:

- PyScript controla criação, configuração e ciclo de vida do worker;
- Pyodide executa CPython e faz a ponte entre objetos JavaScript e Python;
- o EdgePy Viewer transfere `Float32Array` pelo canal nativo do Web Worker, evitando serializar pixels e voxels em JSON;
- `packages/core` continua independente de PyScript, Pyodide, DOM e dados de pixel.

As versões do runtime são fixadas: PyScript 2026.7.2 e Pyodide 0.28.3. O módulo PyScript é carregado sob demanda de `pyscript.net`, o que mantém compatibilidade com o bundle hosted IIFE.

## Executar um exemplo

1. Importe um estudo e aguarde o slice aparecer no viewport.
2. Abra `Agents` no rail lateral.
3. Mantenha a aba `Editor` selecionada.
4. Escolha `Image summary`, `Threshold mask` ou `Dose statistics`.
5. Revise o código e pressione `Run script`.

O runtime só é carregado na primeira execução. O botão `Stop` termina o worker imediatamente. O próximo `Run script` cria um ambiente Python limpo. `Reset` também restaura o exemplo e remove o overlay temporário.

## Ajustar o espaço do editor

Os controles no topo do `PyScript Lab` permitem alternar entre três apresentações sem interromper o código ou perder o conteúdo editado:

- `Dock` posiciona o painel na parte inferior e redimensiona o viewport, como o terminal integrado do VS Code;
- `Maximize` faz o painel ocupar toda a área de trabalho à direita do rail;
- `Side` ou `Restore` retorna ao painel lateral.

No mobile, `Dock` ocupa a metade inferior disponível e `Maximize` usa a área completa do viewer.

## Objetos disponíveis no Python

Cada execução recebe quatro nomes globais:

| Nome | Conteúdo |
| --- | --- |
| `edgepy_context` | snapshot do estudo, scan, série, slice e layers visíveis |
| `edgepy_input` | metadados da imagem ativa e, quando solicitado, da dose |
| `edgepy_image_values` | pixels do slice ativo como typed array JavaScript |
| `edgepy_dose_values` | voxels MHD/RAW como typed array ou `None` |

O editor sempre recebe uma cópia dos pixels decodificados. Marque `Include visible MHD/RAW dose volume` apenas quando o script realmente precisar da dose, porque volumes completos consomem mais memória.

## Retornar resultados

O script deve atribuir um valor serializável à variável `result`. Um resultado numérico simples pode usar:

```python
values = [float(value) for value in edgepy_image_values]

result = {
    "type": "image-summary",
    "status": "completed",
    "summary": {
        "minimum": min(values),
        "maximum": max(values),
        "mean": sum(values) / len(values),
    },
}
```

Para exibir uma máscara temporária no slice atual, adicione `overlay`:

```python
result = {
    "type": "image-mask",
    "status": "completed",
    "overlay": {
        "id": "my-mask",
        "label": "My PyScript mask",
        "color": "#2be3d2",
        "opacity": 0.55,
        "width": edgepy_input["image"]["width"],
        "height": edgepy_input["image"]["height"],
        "sliceIndex": edgepy_input["image"]["sliceIndex"],
        "values": [0.0, 1.0],  # um valor por pixel
    },
}
```

`values` precisa conter exatamente `width × height` valores. O overlay é vinculado ao `sliceIndex` que originou a análise e desaparece nos demais slices. Ele é experimental, fica somente em memória e não altera os arquivos DICOM.

## Agentes empacotados

A aba `Agents` usa o mesmo worker PyScript. `Load agents` instala os módulos publicados em `agents/`, e `Run agent` executa o agente selecionado contra o snapshot atual.

Os agentes de referência são:

- `Viewer Context Summary`, para inspecionar o contexto do viewer;
- `Dose Statistics`, para analisar o volume MHD/RAW visível.

## Segurança e CSP

O código é executado localmente, mas continua sendo código fornecido pelo usuário. Use scripts confiáveis e preserve a confirmação explícita por `Run script`.

O host precisa permitir o worker criado pelo PyScript e o interpretador fixado no jsDelivr. Em uma CSP restritiva, avalie pelo menos:

```text
worker-src 'self' blob:;
script-src 'self' https://pyscript.net https://cdn.jsdelivr.net;
connect-src 'self' https://pyscript.net https://cdn.jsdelivr.net;
```

Uma implantação totalmente same-origin pode publicar o interpretador Pyodide em origem aprovada e alterar a configuração do adapter em um build controlado.

!!! warning "Uso clínico"
    Scripts, máscaras e estatísticas do PyScript Lab são experimentais. Os resultados exigem validação humana e não devem ser usados automaticamente para diagnóstico ou decisão clínica.
