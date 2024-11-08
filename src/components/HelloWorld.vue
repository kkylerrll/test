<template>
  <div>
    <canvas id="myCanvas"></canvas>
  </div>
</template>

<script setup>
  // import { onMounted, nextTick } from "vue";
  import * as fabric from "fabric";
  const canvas = new fabric.Canvas(document.getElementById("myCanvas"));
  // onMounted(() => {
  //   nextTick(() => {
  //     canvas = new fabric.Canvas("myCanvas", {
  //       width: 500,
  //       height: 500,
  //       backgroundColor: "white",
  //     });
  //   });
  // });
  const demoImg = "https://fabricjs.github.io/assets/pug.jpg";
  // const imgElement = new Image();
  // imgElement.src = demoImg;
  // const imgInstance = new fabric.Image(
  //   "https://fabricjs.github.io/assets/pug.jpg",
  //   {
  //     left: 0,
  //     top: 0,
  //     width: 150,
  //     height: 150,
  //   }
  // );
  fabric.Image.fromURL(demoImg).then((img) => {
    img.set({
      dirty: true,
      left: 0,
      top: 0,
      width: 150,
      height: 150,
    });
    canvas.add(img);
  });
  // eslint-disable-next-line no-undef
  // const imgInstance = new FabricImage(demoImg, {
  //   left: 0,
  //   top: 0,
  //   width: 150,
  //   height: 150,
  // });
  // canvas.add(imgInstance);
</script>
<style scoped></style>
