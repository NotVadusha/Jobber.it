from __future__ import annotations

from jobber import db
from jobber import index as index_mod

from .. import boot_no_llm, noargs

CHECKPOINT = 100


def index() -> int:
    postings = db.pending_index()
    if not postings:
        print("nothing to index")
        return 0
    done = index_mod.existing_ids()
    written = 0
    for i in range(0, len(postings), CHECKPOINT):
        batch = postings[i : i + CHECKPOINT]
        records = [chunk for posting in batch for chunk in index_mod.chunks(posting)
                   if chunk["_id"] not in done]
        if records:
            written += index_mod.upsert(records)
        db.mark_indexed([p["id"] for p in batch])
        print(f"  {min(i + CHECKPOINT, len(postings))}/{len(postings)} indexed "
              f"({len(records)} new chunks)", flush=True)
    print(f"{written} chunks from {len(postings)} postings -> "
          f"{index_mod.DENSE_INDEX} + {index_mod.SPARSE_INDEX} (ns {index_mod.NAMESPACE})")
    return 0


if __name__ == "__main__":
    noargs("python -m jobber_cron.gather.index", __doc__)
    boot_no_llm()
    raise SystemExit(index())
