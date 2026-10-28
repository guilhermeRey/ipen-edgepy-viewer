# Selecionar uma ROI na imagem principal

Disponível a partir do **EdgePy Viewer v0.3.0**. A capacidade opcional `beginRectangularRoi()` permite que um painel receba uma seleção retangular feita diretamente no viewport principal. O renderer Cornerstone implementa essa operação, incluindo as transformações de zoom e deslocamento.

## Contrato

Os tipos são exportados por `@pycom-next/react-viewer`:

- `ClinicalViewportRoi`: limites inteiros `x0`, `x1`, `y0`, `y1`.
- `ClinicalViewportImageIdentity`: dimensões, índice do corte e identidades da imagem e da série.
- `ClinicalViewportRoiOptions`: identidade esperada e callback `onChange`.
- `ClinicalViewportRoiSession`: operações `setRoi()` e `dispose()`.

A ROI usa intervalos semiabertos `x=[x0,x1)` e `y=[y0,y1)`. O pixel `(x,y)` corresponde a `values[y * width + x]`. Uma dimensão zero representa uma seleção vazia.

`beginRectangularRoi()` retorna `undefined` quando a imagem ainda está indisponível ou a identidade lida não corresponde ao corte visível. O callback recebe `{ image, roi }` durante a seleção e `undefined` quando a sessão é invalidada, por exemplo ao trocar o corte. Uma nova sessão substitui a anterior.

## Conectar um painel React

Receba o handle por `onViewportRendererHandleChange` e o contexto por `onControlPlaneSnapshotChange`. O efeito abaixo mostra a leitura assíncrona, o descarte de respostas antigas e a limpeza da sessão:

```tsx
import { useEffect, useState } from "react";
import type {
  ClinicalViewportRendererHandle,
  ClinicalViewportRoi,
  ClinicalViewportRoiSession,
} from "@pycom-next/react-viewer";

export function RoiPanel({ handle, contextKey }: {
  handle: ClinicalViewportRendererHandle | undefined;
  contextKey: string;
}) {
  const [roi, setRoi] = useState<ClinicalViewportRoi>();
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let session: ClinicalViewportRoiSession | undefined;
    setRoi(undefined);
    setMessage("Lendo corte…");

    async function start() {
      if (!handle?.getCurrentImageData || !handle.beginRectangularRoi) {
        setMessage("O renderer não oferece leitura de pixels e seleção de ROI.");
        return;
      }
      try {
        const image = await handle.getCurrentImageData();
        if (cancelled) return;
        if (!image) {
          setMessage("Aguarde a imagem e tente novamente.");
          return;
        }
        session = handle.beginRectangularRoi({
          image: {
            width: image.width, height: image.height,
            sliceIndex: image.sliceIndex, imageId: image.imageId,
            seriesUid: image.seriesUid,
          },
          onChange(selection) {
            if (cancelled) return;
            setRoi(selection?.roi);
            setMessage(selection ? "Seleção atualizada." : "A imagem mudou.");
            // Calcule aqui com image.values e selection.roi, se houver seleção.
          },
        });
        setMessage(session ? "Arraste na imagem principal." : "Aguarde a imagem e tente novamente.");
      } catch (error) {
        if (!cancelled) setMessage(String(error));
      }
    }
    void start();
    return () => { cancelled = true; session?.dispose(); };
  }, [handle, contextKey, revision]);

  return <section>
    <button onClick={() => setRevision((value) => value + 1)}>Ler corte</button>
    <p role="status">{message}</p>
    {roi && <p>x=[{roi.x0},{roi.x1}) · y=[{roi.y0},{roi.y1})</p>}
  </section>;
}
```

Faça `contextKey` acompanhar estudo, aquisição, série base e corte. Se o aplicativo substituir um estudo mantendo seus identificadores, inclua também uma revisão da importação nessa chave. Ao fechar o painel, a desmontagem libera a sessão. O painel consumidor não chama `handle.destroy()`.

Para selecionar por teclado ou por um botão, use `session.setRoi(roi)`. Essa operação atualiza o contorno e chama o mesmo callback. Ela retorna `false` para coordenadas inválidas ou uma sessão encerrada.

## Implementar outro renderer

`bindRectangularRoi()` é um helper DOM público usado pelos adaptadores. Ele recebe o elemento, a identidade da imagem, `isCurrent()`, `canvasToImage()` e `imageToCanvas()`. O renderer fornece a geometria e invalida a sessão ao trocar a imagem. O helper cuida de arraste, captura do ponteiro, contorno SVG e limpeza.

O adaptador Cornerstone usa `canvasToWorld`, `worldToIndex`, `indexToWorld` e `worldToCanvas`. Eventos de câmera, renderização e tamanho redesenham o contorno. O cálculo do painel usa a matriz original fornecida pelo renderer, independentemente da janela de visualização.

Para o exemplo completo com gráfico, veja o [tutorial de histograma](https://docs.edgepy.dev/how-to/criar-painel-histograma/).
