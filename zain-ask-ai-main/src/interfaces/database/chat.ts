export interface IReferenceChunk {
  id: string;
  content: string;
  document_id: string;
  document_name?: string;
  dataset_id?: string;
  image_id?: string;
  similarity?: number;
  vector_similarity?: number;
  term_similarity?: number;
  positions?: number[];
  doc_type?: string;
  url?: string;
}

export interface Docagg {
  count: number;
  doc_id: string;
  doc_name: string;
  url?: string;
}

export interface IReference {
  chunks: IReferenceChunk[];
  doc_aggs: Docagg[];
  total?: number;
}