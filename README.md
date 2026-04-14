Minimal example to use AR.js with hiro marker (can be changed) 
Models can be added in .glb format (this works with blender and apparently also plotly and matplotlib; which would be great for our usecase) 


change index.html body like this: #yet to be tested and add models in directory /models

<body style="margin: 0; overflow: hidden;">
  
  <a-scene embedded arjs="debugUIEnabled: false;">

    <!-- Preload model -->
    <a-assets>
      <a-asset-item id="myModel" src="models/model.glb"></a-asset-item>
    </a-assets>

    <!-- Marker -->
    <a-marker preset="hiro">

      <!-- Your 3D model -->
      <a-entity 
        gltf-model="#myModel"
        position="0 0 0"
        scale="0.5 0.5 0.5"
        rotation="0 180 0">
      </a-entity>

    </a-marker>

    <a-entity camera></a-entity>
  </a-scene>
</body>


Repo must be public, then -> Settings -> Pages -> Deploy From Branch -> Main  (will disable that when not in use just in case)
Open URL on phone, when scannning marker, shows model on top of marker -> best: print out and lay on table
