"""Lightweight TF-IDF vector search (offline RAG fallback)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.assistant.knowledge.search import tokenize


@dataclass
class TfidfIndex:
    chunk_ids: list[str]
    matrix: np.ndarray  # (n_chunks, vocab)
    idf: np.ndarray
    vocab: dict[str, int]

    def query_scores(self, query: str) -> np.ndarray:
        tokens = tokenize(query)
        if not tokens:
            return np.zeros(len(self.chunk_ids))
        counts: dict[str, int] = {}
        for token in tokens:
            counts[token] = counts.get(token, 0) + 1
        vec = np.zeros(len(self.vocab))
        for token, count in counts.items():
            idx = self.vocab.get(token)
            if idx is not None:
                vec[idx] = count
        if vec.sum() == 0:
            return np.zeros(len(self.chunk_ids))
        vec = vec * self.idf
        norms = np.linalg.norm(self.matrix, axis=1) * np.linalg.norm(vec)
        norms = np.where(norms == 0, 1.0, norms)
        return (self.matrix @ vec) / norms


def _doc_tokens(text: str) -> list[str]:
    return tokenize(text)


def build_tfidf_index(texts: list[str], chunk_ids: list[str]) -> TfidfIndex:
    docs = [_doc_tokens(t) for t in texts]
    vocab: dict[str, int] = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)

    n_docs = max(len(docs), 1)
    df = np.zeros(len(vocab))
    for doc in docs:
        for token in set(doc):
            df[vocab[token]] += 1.0
    idf = np.log((1.0 + n_docs) / (1.0 + df)) + 1.0

    matrix = np.zeros((len(docs), len(vocab)))
    for row, doc in enumerate(docs):
        counts: dict[str, int] = {}
        for token in doc:
            counts[token] = counts.get(token, 0) + 1
        for token, count in counts.items():
            matrix[row, vocab[token]] = count
        matrix[row] *= idf

    return TfidfIndex(chunk_ids=chunk_ids, matrix=matrix, idf=idf, vocab=vocab)
