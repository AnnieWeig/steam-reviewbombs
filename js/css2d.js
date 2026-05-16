/**
 * CSS2D — stored as plain classes so A-Frame can never overwrite them
 * by clobbering the THREE global.
 */
export class CSS2DObject extends THREE.Object3D {
  constructor(el) {
    super();
    this.element = el;
    el.style.position  = "absolute";
    el.style.userSelect = "none";
  }
}

export class CSS2DRenderer {
  constructor() {
    this.domElement = document.createElement("div");
    this.domElement.style.overflow = "hidden";
  }

  setSize(w, h) {
    this.domElement.style.width  = w + "px";
    this.domElement.style.height = h + "px";
    this._w = w;
    this._h = h;
  }

  render(scene, camera) {
    const proj = new THREE.Vector3();
    scene.traverse((obj) => {
      if (!(obj instanceof CSS2DObject)) return;
      proj.setFromMatrixPosition(obj.matrixWorld);
      proj.project(camera);
      const x = (proj.x *  0.5 + 0.5) * this._w;
      const y = (proj.y * -0.5 + 0.5) * this._h;
      obj.element.style.transform =
        `translate(-50%,-50%) translate(${x}px,${y}px)`;
      obj.element.style.display = proj.z > 1 ? "none" : "";
      if (!obj.element.parentNode) this.domElement.appendChild(obj.element);
    });
  }
}