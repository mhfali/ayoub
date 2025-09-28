import classNames from 'classnames';

interface IImage {
  id: string;
  className: string;
  style?: React.CSSProperties;
  onClick?(): void;
}

const Image = ({ id, className, style, onClick }: IImage) => {
  return (
    <img
      src={`${import.meta.env.VITE_BASE_URL}/v1/document/image/${id}`}
      alt=""
      className={classNames('w-full h-[50vh] ', className)}
      style={style}
      onClick={onClick}
    />
  );
};

export default Image;