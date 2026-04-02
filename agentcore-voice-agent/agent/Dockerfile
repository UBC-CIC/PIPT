FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y awscrt || true && \
    rm -rf /usr/local/lib/python3.12/site-packages/awscrt*

COPY . .

EXPOSE 8080

CMD ["python", "bot.py", "--host", "0.0.0.0", "--port", "8080"]