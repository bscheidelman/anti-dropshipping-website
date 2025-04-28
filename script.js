//SECTION 1: Uploading images and formating etc.

const dropArea = document.getElementById("drop-area");
const inputFile = document.getElementById("input-file");
const imageView = document.getElementById("img-view");
const productSection = document.getElementById("product-section");
const dropAreaProduct = document.getElementById("drop-area-product");
const inputFileProduct = document.getElementById("input-file-product");
const imageViewProduct = document.getElementById("img-view-product");

inputFile.addEventListener("change", uploadImage);
inputFileProduct.addEventListener("change", uploadImageProduct);

dropArea.addEventListener("dragover", function (e) {
  e.preventDefault();
});
dropArea.addEventListener("drop", function (e) {
  e.preventDefault();
  inputFile.files = e.dataTransfer.files;
  uploadImage();
});

dropAreaProduct.addEventListener("dragover", function (e) {
  e.preventDefault();
});
dropAreaProduct.addEventListener("drop", function (e) {
  e.preventDefault();
  inputFileProduct.files = e.dataTransfer.files;
  uploadImageProduct();
});

function uploadImage() {
  let imgLink = URL.createObjectURL(inputFile.files[0]);
  imageView.style.backgroundImage = `url(${imgLink})`;
  imageView.textContent = "";
  imageView.style.border = 0;

  imageView.classList.add("uploaded-image");

  const productImgView = document.querySelector("#product-section #img-view-product");
  productImgView.style.backgroundImage = `url(${imgLink})`;
  productImgView.textContent = "";
  productImgView.style.border = 0;
  productImgView.classList.add("uploaded-image");

  handleImageUpload(inputFile.files[0]); // no screen switch here anymore
}



function uploadImageProduct() {
  let imgLink = URL.createObjectURL(inputFileProduct.files[0]);
  imageViewProduct.style.backgroundImage = `url(${imgLink})`;
  imageViewProduct.textContent = ""; 
  imageViewProduct.style.border = 0;
  imageViewProduct.classList.add("uploaded-image");
}




//SECTION 2: Reverse image search and API usage

const CLIENT_ID = "your client id";
  

let serverFinished = false;

async function handleImageUpload(imageFile) {
  const formData = new FormData();
  formData.append("image", imageFile);

  const uploadedImageUrl = await createUrl(formData);
  if (uploadedImageUrl) {
    console.log("Uploaded Image URL:", uploadedImageUrl);

    startLoadingAnimation(); // Start loading

    const searchResults = await searchUrl(uploadedImageUrl);

    serverFinished = true; // <-- server call is done

    console.log(searchResults);
    if (searchResults && searchResults.image_results) {
      updateProductList(searchResults.image_results.slice(0, 5));
    } else {
      console.error("No image_results found in searchResults:", searchResults);
    }
  }
}




function updateProductList(results) {
  const productElements = document.querySelectorAll("#product-list .product");

  for (let i = 0; i < productElements.length; i++) {
    const productElement = productElements[i];
    const result = results[i];

    if (result) {
      // Update product fields
      const titleElement = productElement.querySelector("h2");
      const sellerElement = productElement.querySelector("p");
      const linkElement = productElement.querySelector("a");

      titleElement.textContent = result.title || "No Title";
      sellerElement.textContent = `Seller: ${result.source || "Unknown"}`;
      linkElement.href = result.link || "#";
      linkElement.textContent = "Visit Product";
    } else {
      // Clear the product slot if no result
      productElement.querySelector("h2").textContent = "No Product Found";
      productElement.querySelector("p").textContent = "";
      productElement.querySelector("a").href = "#";
      productElement.querySelector("a").textContent = "";
    }
  }
}


async function searchUrl(uploadedImageUrl) {
  try {
    const response = await fetch("http://127.0.0.1:3000", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ imageUrl: uploadedImageUrl })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling server:", error);
    return null;
  }
}

  
  async function createUrl(formData) {
    const response = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: {
        "Authorization": `Client-ID ${CLIENT_ID}`
      },
      body: formData
    });
  
    const data = await response.json();
  
    if (data.success) {
      return data.data.link;
    } else {
      console.error("Error uploading image to Imgur:", data);
      return null;
    }
  }


  function startLoadingAnimation() {
    const overlay = document.getElementById("loading-overlay");
    const bar = document.getElementById("loading-bar");
    const hero = document.querySelector(".hero");
    const productSection = document.getElementById("product-section");
  
    // Initially hide the bar, will be shown when animation starts
    bar.style.display = "block"; // Make the bar visible
    overlay.style.display = "block";
    overlay.style.background = "transparent";
    bar.style.left = "0";
  
    let startTime = null;
    let baseDuration = 7000; // 7 seconds
    let speedMultiplier = 1; // Normal speed
    let lastElapsed = 0;
    let serverFinished = false;
  
    function easeInOut(t) {
      return t < 0.5
        ? 2 * t * t
        : -1 + (4 - 2 * t) * t;
    }
  
    function animate(time) {
      if (!startTime) startTime = time;
  
      let elapsed = (time - startTime) * speedMultiplier;
      let percent = Math.min(elapsed / baseDuration, 1);
      let easedPercent = easeInOut(percent);
  
      bar.style.left = `${easedPercent * 100}%`;
  
      overlay.style.background = `linear-gradient(to right, rgba(240, 240, 240, 0.4) ${easedPercent * 100}%, transparent ${easedPercent * 100}%)`;
  
      if (serverFinished && speedMultiplier === 1) {
        // Boost speed once server finishes
        speedMultiplier = 3; // Triple speed
      }
  
      if (percent < 1) {
        requestAnimationFrame(animate);
      } else {
        overlay.style.display = "none"; // Hide the overlay after animation completes
  
        // Fade out the hero section
        hero.style.opacity = "0";
  
        // Fade in the product section after the fade-out completes
        setTimeout(() => {
          hero.style.display = "none"; // Hide the hero section completely
          productSection.classList.remove("hidden");
          productSection.style.opacity = "1"; // Start fading in product section
        }, 1000); // Match the fade-out duration in CSS (1s)
      }
    }
  
    requestAnimationFrame(animate);
  }
  
  function scrollToHero() {
    const heroSection = document.querySelector('.hero');
    window.scrollTo({
        top: heroSection.offsetTop,
        behavior: 'smooth'
    });
}
