FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies
RUN yum -y install postgresql-devel gcc gcc-c++ libpq make

# Copy locked requirements and install
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt --no-cache-dir

# Copy the source code
COPY src/ ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "main.handler" ]