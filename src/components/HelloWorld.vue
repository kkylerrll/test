<template>
  <div>
    <canvas id="myCanvas"></canvas>
  </div>
</template>

<script setup>
  import { onMounted } from "vue";
  import { fabric } from "fabric";
  import "./photo";
  import "./filter";

  onMounted(() => {
    fabric.textureSize = 1000;

    fabric.filterBackend = new fabric.WebglFilterBackend();
    fabric.isWebglSupported(fabric.textureSize);

    const canvas = new fabric.Canvas(document.getElementById("myCanvas"), {
      backgroundColor: "white",
      enableRetinaScaling: true,
    });

    function resizeCanvas() {
      canvas.setWidth(window.innerWidth);
      canvas.setHeight(window.innerHeight);
    }
    resizeCanvas();
    window.addEventListener("resize", () => resizeCanvas(), false);

    const photo = new fabric.Photo(
      "https://glcouduser-11a82.kxcdn.com/1/savedDesign/thumbnails/43955.jpeg",
      {
        left: canvas.getWidth() / 2,
        top: canvas.getHeight() / 2,
        originX: "center",
        originY: "center",
      }
    );
    canvas.add(photo);
    canvas.setActiveObject(photo);

    // const imgEl = document.createElement("img");
    // imgEl.crossOrigin = "Anonymous";
    // imgEl.src =
    //   "https://glcouduser-11a82.kxcdn.com/1/savedDesign/thumbnails/43955.jpeg";
    // imgEl.onload = () => {
    //   const image = new fabric.Image(imgEl, {
    //     scaleX: 0.5,
    //     scaleY: 0.5,
    //     angle: 15,
    //     top: 60,
    //     left: 300,
    //   });
    //   canvas.add(image);
    // };
  });
</script>
<style scoped></style>
