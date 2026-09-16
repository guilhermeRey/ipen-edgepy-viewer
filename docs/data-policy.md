# Política de dados clínicos e datasets

## Escopo

O código-fonte e a documentação autoral do EdgePy Viewer são distribuídos sob Apache License 2.0. Essa licença não cobre automaticamente datasets clínicos, arquivos DICOM, VOIs, RTSTRUCTs, máscaras, mapas de dose ou outros dados derivados de pacientes.

## Dados não incluídos

Não devem ser considerados parte da distribuição Apache 2.0, salvo declaração escrita específica:

- arquivos DICOM ou `.IMA` de pacientes;
- ZIPs de validação;
- pacotes VOI/RTSTRUCT;
- mapas de dose, máscaras e screenshots derivados de pacientes;
- metadados clínicos reais;
- datasets anonimizados com restrição acadêmica, institucional ou comercial.

## Regras de versionamento

- Não commitar dados clínicos nem identificadores persistentes.
- Usar somente fixtures sintéticas ou amostras com licença pública documentada.
- Manter datasets locais em caminhos ignorados pelo Git.
- Revisar imagens e vídeos quadro a quadro antes de qualquer publicação.
- Documentar origem, licença e autorização de redistribuição de toda amostra pública.

## Integração com hosts clínicos

Em modo hosted, o sistema externo controla autenticação, autorização e entrega dos assets. O viewer deve trafegar referências por contratos e evitar envio desnecessário de pixels e voxels a serviços externos.

## Responsabilidade do contribuidor

Todo contribuidor é responsável por garantir que arquivos incluídos em commits, pull requests e releases podem ser redistribuídos publicamente.
