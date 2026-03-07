from typing import Dict

from helpers.helper import store_group_data

def update_vectorstore(
    bucket: str,
    group: str,
    patient_id: str,
    vectorstore_config_dict: Dict[str, str],
    embeddings,#: BedrockEmbeddings
    connection
) -> None:
    """
    Update the vectorstore with embeddings for all documents and images in the S3 bucket.

    Args:
    bucket (str): The name of the S3 bucket containing the group folders.
    group (str): The name of the group folder within the S3 bucket.
    vectorstore_config_dict (Dict[str, str]): The configuration dictionary for the vectorstore, including parameters like collection name, database name, user, password, host, and port.
    embeddings (BedrockEmbeddings): The embeddings instance used to process the documents and images.

    Returns:
    None
    """
    store_group_data(
        bucket=bucket,
        group=group,
        patient_id=patient_id,
        vectorstore_config_dict=vectorstore_config_dict,
        embeddings=embeddings,
        connection=connection
    )