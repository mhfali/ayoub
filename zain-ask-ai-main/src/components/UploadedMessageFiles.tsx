import { IDocumentInfo } from '../interfaces/database/document';
import { getExtension } from '../utils/document-util';
import SvgIcon from './svg-icon';
import NewDocumentLink from './NewDocumentLink';
import FileIcon from './FileIcon';

interface IProps {
  files?: File[] | IDocumentInfo[];
}

type NameWidgetType = {
  name: string;
  size: number;
  id?: string;
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

function NameWidget({ name, size, id }: NameWidgetType) {
  return (
    <div className="text-xs ">
      {id ? (
        <NewDocumentLink documentId={id} documentName={name} prefix="document">
          {name}
        </NewDocumentLink>
      ) : (
        <div className="truncate">{name}</div>
      )}
      <p className="text-text-secondary pt-1">{formatBytes(size)}</p>
    </div>
  );
}

export function InnerUploadedMessageFiles({ files = [] }: IProps) {
  return (
    <section className="flex gap-2 pt-2">
      {files?.map((file, idx) => {
        const name = file.name;
        const isFile = file instanceof File;

        return (
          <div key={idx} className="flex gap-2 border rounded-md p-1.5 items-center">
            {!isFile ? (
              <FileIcon id={file.id} name={name}></FileIcon>
            ) : file.type.startsWith('image/') ? (
              <img
                src={URL.createObjectURL(file)}
                alt={name}
                className="size-10 object-cover rounded"
              />
            ) : (
              <div className="size-10 flex items-center justify-center">
                <SvgIcon
                  name={`file-icon/${getExtension(name)}`}
                  width={24}
                />
              </div>
            )}
            <NameWidget
              name={name}
              size={file.size}
              id={isFile ? undefined : file.id}
            />
          </div>
        );
      })}
    </section>
  );
}

export const UploadedMessageFiles = InnerUploadedMessageFiles;