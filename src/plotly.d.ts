// The prebuilt 3D-only plotly bundle ships without types; reuse the full plotly.js ones
declare module "plotly.js-gl3d-dist-min" {
  import * as Plotly from "plotly.js";
  export = Plotly;
}
