# Third-Party Notices

EdgePy Viewer depends on open-source projects. The dependency graph and exact versions are recorded in `package-lock.json`.

Principal runtime projects include:

| Project | License |
| --- | --- |
| React | MIT |
| Vite | MIT |
| CodeMirror | MIT |
| Cornerstone3D and DICOM Image Loader | MIT |
| dicom-parser | MIT |
| Comlink | Apache-2.0 |
| JSZip | MIT or GPL-3.0; this project uses it under MIT |
| PyScript | Apache-2.0 |
| Pyodide | MPL-2.0 |
| IBM Plex | OFL-1.1 |
| Space Grotesk | OFL-1.1 |

PyScript, Pyodide and web fonts are loaded from external services by the default demo. They are not vendored in this source repository.

Cornerstone distributions can include codec wrappers and WebAssembly implementations based on CharLS, OpenJPEG, OpenJPH and libjpeg-turbo. Anyone redistributing generated binaries must review the exact output, retain upstream notices and include all license texts required by the bundled versions.

This summary is not a substitute for the license files shipped by each dependency. Run a dependency and bundle license audit for every release artifact.
