import classNames from "classnames";
import type { LiteralUnion } from "../__util/type";
import type { PresetColorType, PresetStatusColorType } from "../__util/color";

const prefixCls = 'tag';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
    className?: string;
    color?: LiteralUnion<PresetColorType | PresetStatusColorType>;
    /** @deprecated `visible` will be removed in next major version. */
    visible?: boolean;
    style?: React.CSSProperties;
    bordered?: boolean;
  }

export default function (props: TagProps) {
    const { color, className, children, bordered, ...restProps } = props;
    const classString = classNames({
        [prefixCls]: true,
        [`${prefixCls}-${color}`]: !!color,
        // @ts-ignore
        [className]: !!className,
      });
    return (<span {...restProps} className={classString}>
        <span className={`${prefixCls}-text`}>{children}</span>
    </span>)
}
