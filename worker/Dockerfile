FROM python:3.11-slim

# Ensure Python output is not buffered (for real-time logs)
ENV PYTHONUNBUFFERED=1

# Install system dependencies for OCR (Phase 2b)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

# Run the worker
CMD ["python", "-m", "src.main"]
