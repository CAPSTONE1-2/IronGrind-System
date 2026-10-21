function initDigitalSignature(canvasId, clearButtonId) {
    const canvas = document.getElementById(canvasId);
    const clearButton = document.getElementById(clearButtonId);
    if (!canvas || !clearButton) return null;

    const context = canvas.getContext('2d');
    const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const bounds = canvas.getBoundingClientRect();
    canvas.width = Math.round(bounds.width * pixelRatio);
    canvas.height = Math.round(bounds.height * pixelRatio);
    context.scale(pixelRatio, pixelRatio);
    context.strokeStyle = '#11161f';
    context.fillStyle = '#11161f';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    let drawing = false;
    let hasSignature = false;

    function getPoint(event) {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    canvas.addEventListener('pointerdown', event => {
        event.preventDefault();
        drawing = true;
        canvas.setPointerCapture(event.pointerId);
        const point = getPoint(event);
        context.beginPath();
        context.arc(point.x, point.y, 1, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(point.x, point.y);
        hasSignature = true;
    });

    canvas.addEventListener('pointermove', event => {
        if (!drawing) return;
        event.preventDefault();
        const point = getPoint(event);
        context.lineTo(point.x, point.y);
        context.stroke();
        context.beginPath();
        context.moveTo(point.x, point.y);
    });

    function stopDrawing() { drawing = false; }
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    canvas.addEventListener('lostpointercapture', stopDrawing);

    function clear() {
        context.clearRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
        hasSignature = false;
    }
    clearButton.addEventListener('click', clear);

    return {
        isEmpty: () => !hasSignature,
        toDataURL: () => canvas.toDataURL('image/png'),
        clear
    };
}
