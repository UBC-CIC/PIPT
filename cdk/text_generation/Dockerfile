# Stage 1: Builder — compile C extensions
FROM public.ecr.aws/lambda/python:3.12 AS builder

# Install system build dependencies
RUN dnf -y install postgresql-devel gcc gcc-c++ libpq make

# Copy locked requirements and install to a clean target directory
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt --no-cache-dir --target /install

# Stage 2: Runtime — slim image
FROM public.ecr.aws/lambda/python:3.12

# Install only runtime shared libraries
RUN dnf -y install libpq && dnf clean all

# Copy compiled packages from builder
COPY --from=builder /install ${LAMBDA_TASK_ROOT}

# Copy application source
COPY src/ ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD ["main.handler"]
