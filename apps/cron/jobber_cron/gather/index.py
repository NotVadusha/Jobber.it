from __future__ import annotations

from jobber import db
from jobber import pinecone
from jobber.logging import get_logger

from .. import boot_no_llm, noargs

CHECKPOINT = 100

logger = get_logger(service="cron", module=__name__)


def index() -> int:
    postings = db.pending_index()
    if not postings:
        logger.info("index_skipped", "No postings are pending indexing")
        return 0
    done = pinecone.existing_ids()
    written = 0
    for i in range(0, len(postings), CHECKPOINT):
        batch = postings[i : i + CHECKPOINT]
        records = [chunk for posting in batch for chunk in pinecone.chunks(posting)
                   if chunk["_id"] not in done]
        if records:
            written += pinecone.upsert(records)
        db.mark_indexed([p["id"] for p in batch])
        logger.info(
            "index_checkpoint",
            "Indexing checkpoint reached",
            indexed=min(i + CHECKPOINT, len(postings)),
            total=len(postings),
            new_chunks=len(records),
        )
    logger.info(
        "index_completed",
        "Indexing completed",
        chunks=written,
        postings=len(postings),
        dense_index=pinecone.DENSE_INDEX,
        sparse_index=pinecone.SPARSE_INDEX,
        namespace=pinecone.NAMESPACE,
    )
    return 0


if __name__ == "__main__":
    noargs("python -m jobber_cron.gather.index", __doc__)
    boot_no_llm()
    raise SystemExit(index())
