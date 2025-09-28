import { useState, useEffect } from 'react';
import { IDocumentInfo } from '../interfaces/database/document';

export const useFetchDocumentThumbnailsByIds = () => {
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentIds.length === 0) {
      setData({});
      return;
    }

    const fetchThumbnails = async () => {
      setLoading(true);
      setError(null);

      try {
        const docIdsParam = documentIds.map(id => `doc_ids=${id}`).join('&');
        const response = await fetch(`${import.meta.env.VITE_BASE_URL}/v1/document/thumbnails?${docIdsParam}`, {
          headers: {
            'Authorization': import.meta.env.VITE_TOKEN,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch thumbnails: ${response.status}`);
        }

        const result = await response.json();
        if (result.code === 0) {
          // Prepend base URL to thumbnail paths
          const thumbnailsWithBaseUrl: Record<string, string> = {};
          Object.entries(result.data).forEach(([id, url]) => {
            thumbnailsWithBaseUrl[id] = url ? `${import.meta.env.VITE_BASE_URL}${url}` : '';
          });
          setData(thumbnailsWithBaseUrl);
        } else {
          throw new Error(result.message || 'Failed to fetch thumbnails');
        }
      } catch (err) {
        console.error('Error fetching document thumbnails:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');

        // Fallback: set empty thumbnails
        const thumbnails: Record<string, string> = {};
        documentIds.forEach(id => {
          thumbnails[id] = '';
        });
        setData(thumbnails);
      } finally {
        setLoading(false);
      }
    };

    fetchThumbnails();
  }, [documentIds]);

  return {
    setDocumentIds,
    data,
    loading,
    error
  };
};

export const useFetchDocumentInfosByIds = () => {
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [data, setData] = useState<IDocumentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentIds.length === 0) {
      setData([]);
      return;
    }

    const fetchDocumentInfos = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${import.meta.env.VITE_BASE_URL}/v1/document/infos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': import.meta.env.VITE_TOKEN,
          },
          body: JSON.stringify({
            doc_ids: documentIds
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch document infos: ${response.status}`);
        }

        const result = await response.json();
        if (result.code === 0) {
          setData(result.data);
        } else {
          throw new Error(result.message || 'Failed to fetch document infos');
        }
      } catch (err) {
        console.error('Error fetching document infos:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentInfos();
  }, [documentIds]);

  return {
    setDocumentIds,
    data,
    loading,
    error
  };
};