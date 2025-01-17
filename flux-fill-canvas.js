let BRUSH_RADIUS = 20;
let scale = 1;
let originalImage = null;
let imageNode = null;
let isDrawing = false;

function initializeEditor(config) {
    const imageData = config.images;
    const webhookUrl = config.webhookUrl;
    const pageId = config.pageId;

    // Initialize stage with minimum dimensions
    let stage = new Konva.Stage({
        container: 'container',
        width: 100,
        height: 100
    });

    const layer = new Konva.Layer();
    const maskLayer = new Konva.Layer();
    stage.add(layer);
    stage.add(maskLayer);
    maskLayer.visible(false);

    // Initialize UI elements
    const stepsSlider = document.getElementById('stepsSlider');
    const stepsValue = document.getElementById('stepsValue');
    const guidanceSlider = document.getElementById('guidanceSlider');
    const guidanceValue = document.getElementById('guidanceValue');

    // Update values display for sliders
    stepsSlider.addEventListener('input', function(e) {
        stepsValue.textContent = e.target.value;
    });

    guidanceSlider.addEventListener('input', function(e) {
        guidanceValue.textContent = parseFloat(e.target.value).toFixed(1);
    });

    // Mouse wheel for brush size
    stage.container().addEventListener('wheel', function(e) {
        e.preventDefault();
        
        const delta = e.deltaY;
        const MIN_RADIUS = 5;
        const MAX_RADIUS = 40;
        
        if (delta > 0) {
            BRUSH_RADIUS = Math.max(MIN_RADIUS, BRUSH_RADIUS - 2);
        } else {
            BRUSH_RADIUS = Math.min(MAX_RADIUS, BRUSH_RADIUS + 2);
        }
        
        updateCursorSize();
        
        brushSlider.value = BRUSH_RADIUS;
        brushSizeValue.textContent = `${BRUSH_RADIUS}px`;
        
        const sizeIndicator = document.createElement('div');
        sizeIndicator.style.cssText = `
            position: fixed;
            left: ${e.clientX + 20}px;
            top: ${e.clientY}px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
        `;
        sizeIndicator.textContent = `Brush: ${BRUSH_RADIUS}px`;
        document.body.appendChild(sizeIndicator);
        
        setTimeout(() => {
            sizeIndicator.remove();
        }, 1000);
    });

    // Populate dropdown
    const imageSelector = document.getElementById('imageSelector');
    imageData.forEach(img => {
        const option = document.createElement('option');
        option.value = img.url;
        option.textContent = img.title;
        imageSelector.appendChild(option);
    });

    // Create cursor element
    const cursor = document.getElementById('cursor');
    updateCursorSize();

    // Brush size slider
    const brushSlider = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    
    brushSlider.addEventListener('input', function(e) {
        BRUSH_RADIUS = parseInt(e.target.value);
        brushSizeValue.textContent = BRUSH_RADIUS + 'px';
        updateCursorSize();
    });

    function updateCursorSize() {
        cursor.style.width = (BRUSH_RADIUS * 2 * scale) + 'px';
        cursor.style.height = (BRUSH_RADIUS * 2 * scale) + 'px';
        cursor.style.marginLeft = -(BRUSH_RADIUS * scale) + 'px';
        cursor.style.marginTop = -(BRUSH_RADIUS * scale) + 'px';
    }

    function initializeMaskLayer(width, height) {
        maskLayer.destroyChildren();
        const background = new Konva.Rect({
            x: 0,
            y: 0,
            width: width,
            height: height,
            fill: 'black'
        });
        maskLayer.add(background);
        maskLayer.draw();
    }

    // File input handler
    document.getElementById('fileInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                loadImage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Image selector handling
    imageSelector.addEventListener('change', function(e) {
        const selectedValue = e.target.value;
        
        if (selectedValue === 'local') {
            document.getElementById('fileInput').click();
            imageSelector.value = '';
            return;
        }

        if (!selectedValue) return;

        loadImage(selectedValue);
    });

    function loadImage(src) {
        const img = new Image();
        if (src.startsWith('data:')) {
            img.onload = handleImageLoad;
            img.src = src;
        } else {
            img.crossOrigin = 'anonymous';
            img.onload = handleImageLoad;
            img.onerror = function() {
                console.error('Error loading image');
                alert('Error loading image. The URL might have expired.');
            };
            img.src = src;
        }

        function handleImageLoad() {
            if (imageNode) {
                imageNode.destroy();
            }

            originalImage = img;
            const imgWidth = img.width;
            const imgHeight = img.height;
            const maxWidth = 1200;
            const maxHeight = 650;

            scale = 1;
            if (imgWidth > maxWidth || imgHeight > maxHeight) {
                scale = Math.min(
                    maxWidth / imgWidth,
                    maxHeight / imgHeight
                );
            }

            const displayWidth = Math.round(imgWidth * scale);
            const displayHeight = Math.round(imgHeight * scale);

            stage.width(displayWidth);
            stage.height(displayHeight);

            imageNode = new Konva.Image({
                x: 0,
                y: 0,
                image: img,
                width: displayWidth,
                height: displayHeight
            });

            layer.destroyChildren();
            layer.add(imageNode);
            layer.draw();

            initializeMaskLayer(displayWidth, displayHeight);
            updateCursorSize();

            document.getElementById('imageInfo').innerHTML = 
                `Original image: ${imgWidth}×${imgHeight}px<br>` +
                `Display size: ${displayWidth}×${displayHeight}px` +
                (scale !== 1 ? `<br>Scale: ${scale.toFixed(2)}` : '');
        }
    }

    // Clear button handling
    document.getElementById('clearButton').addEventListener('click', function() {
        if (imageNode) {
            layer.destroyChildren();
            maskLayer.destroyChildren();
            layer.draw();
            maskLayer.draw();
            stage.width(100);
            stage.height(100);
            document.getElementById('imageInfo').innerHTML = '';
            originalImage = null;
            imageSelector.value = '';
        }
    });

    // Send button handling
    document.getElementById('sendButton').addEventListener('click', async function() {
        if (!imageNode || !originalImage) {
            alert('Please select an image first');
            return;
        }

        const sendButton = document.getElementById('sendButton');
        const loadingIndicator = document.getElementById('loadingIndicator');
        
        sendButton.disabled = true;
        loadingIndicator.style.display = 'inline';

        // Get original image as base64
        const originalCanvas = document.createElement('canvas');
        originalCanvas.width = originalImage.width;
        originalCanvas.height = originalImage.height;
        const originalCtx = originalCanvas.getContext('2d');
        originalCtx.drawImage(originalImage, 0, 0);
        const originalBase64 = originalCanvas.toDataURL('image/png');

        // Get mask as base64
        maskLayer.visible(true);
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = originalImage.width;
        maskCanvas.height = originalImage.height;
        const maskCtx = maskCanvas.getContext('2d');
        
        const tempCanvas = maskLayer.toCanvas();
        maskCtx.drawImage(
            tempCanvas,
            0, 0, tempCanvas.width, tempCanvas.height,
            0, 0, originalImage.width, originalImage.height
        );
        const maskBase64 = maskCanvas.toDataURL('image/png');
        maskLayer.visible(false);

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: originalBase64,
                    mask: maskBase64,
                    prompt: document.getElementById('promptInput').value.trim(),
                    prompt_upsampling: document.getElementById('improvePrompt').checked,
                    steps: parseInt(document.getElementById('stepsSlider').value),
                    guidance: parseFloat(document.getElementById('guidanceSlider').value),
                    id: pageId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const modal = document.getElementById('resultModal');
            const resultImage = document.getElementById('resultImage');
            const originalImage = document.getElementById('originalImage');
            const slider = modal.querySelector('.slider');
            const container = modal.querySelector('.comparison-container');

            // Set up images
            originalImage.src = originalCanvas.toDataURL('image/png');
            resultImage.src = blobUrl;
          
            // Set initial slider position
            container.style.setProperty('--position', '15%');
            slider.value = 15;

            // Show modal when both images are loaded
            Promise.all([
                new Promise(resolve => originalImage.onload = resolve),
                new Promise(resolve => resultImage.onload = resolve)
            ]).then(() => {
                modal.style.display = 'block';
            });

            // Set up slider
            slider.addEventListener('input', (e) => {
                container.style.setProperty('--position', `${e.target.value}%`);
            });

            // Re-use button handler
            document.getElementById('reuseButton').onclick = function() {
                loadImage(blobUrl);
                modal.style.display = 'none';
            };

            // Save button handler
            document.getElementById('saveButton').onclick = function() {
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = 'generated-image.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            // Close button handler
            document.getElementById('closeButton').onclick = function() {
                modal.style.display = 'none';
                URL.revokeObjectURL(blobUrl);
            };

            // Close on Escape key
            window.addEventListener('keydown', function(event) {
                if (event.key === 'Escape' && modal.style.display === 'block') {
                    modal.style.display = 'none';
                    URL.revokeObjectURL(blobUrl);
                }
            });

        } catch (error) {
            console.error('Error:', error);
            alert('Error sending image: ' + error.message);
        } finally {
            sendButton.disabled = false;
            loadingIndicator.style.display = 'none';
        }
    });

    // Mouse events for drawing
    stage.on('mousemove', function(e) {
        cursor.style.display = 'block';
        cursor.style.left = (e.evt.clientX + window.scrollX) + 'px';
        cursor.style.top = (e.evt.clientY + window.scrollY) + 'px';

        if (isDrawing && imageNode) {
            const pos = stage.getPointerPosition();
            
            // Draw white circle on mask layer
            const maskCircle = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: BRUSH_RADIUS * scale,
                fill: 'white'
            });
            maskLayer.add(maskCircle);
            maskLayer.draw();

            // Create visual eraser effect
            const visualCircle = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: BRUSH_RADIUS * scale,
                fill: 'black',
                globalCompositeOperation: 'destination-out'
            });
            layer.add(visualCircle);
            layer.draw();
        }
    });

    stage.on('mouseout', function() {
        cursor.style.display = 'none';
    });

    stage.on('mousedown', function() {
        isDrawing = true;
    });

    stage.on('mouseup', function() {
        isDrawing = false;
    });

    // Touch events
    stage.on('touchstart', function(e) {
        isDrawing = true;
        const pos = stage.getPointerPosition();
        if (imageNode) {
            const maskCircle = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: BRUSH_RADIUS * scale,
                fill: 'white'
            });
            maskLayer.add(maskCircle);
            maskLayer.draw();

            const visualCircle = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: BRUSH_RADIUS * scale,
                fill: 'black',
                globalCompositeOperation: 'destination-out'
            });
            layer.add(visualCircle);
            layer.draw();
        }
    });

    stage.on('touchend', function() {
        isDrawing = false;
    });

    stage.on('touchmove', function(e) {
        if (isDrawing && imageNode) {
            const pos = stage.getPointerPosition();
            const maskCircle = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: BRUSH_RADIUS * scale,
                fill: 'white'
            });
            maskLayer.add(maskCircle);
            maskLayer.draw();

            const visualCircle = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: BRUSH_RADIUS * scale,
                fill: 'black',
                globalCompositeOperation: 'destination-out'
            });
            layer.add(visualCircle);
            layer.draw();
        }
    });
}
