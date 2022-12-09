import { createRef, JSX }from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { tuple } from '../__util/type';
import classNames from 'classnames';
import LoadingIcon from './LoadingIcon';

const prefixCls = 'btn';

function isUnBorderedButtonType(type: ButtonType | undefined) {
  return type === 'text' || type === 'link';
}


const ButtonTypes = tuple('default', 'primary', 'ghost', 'dashed', 'link', 'text');
export type ButtonType = typeof ButtonTypes[number];
const ButtonShapes = tuple('default', 'circle', 'round');
export type ButtonShape = typeof ButtonShapes[number];
const ButtonHTMLTypes = tuple('submit', 'button', 'reset');
export type ButtonHTMLType = typeof ButtonHTMLTypes[number];

export type LegacyButtonType = ButtonType | 'danger';
export function convertLegacyProps(type?: LegacyButtonType): BaseButtonProps {
  if (type === 'danger') {
    return { danger: true };
  }
  return { type };
}

export interface BaseButtonProps {
  type?: ButtonType;
  icon?: JSX.Element;
  /**
   * Shape of Button
   *
   * @default default
   */
  shape?: ButtonShape;
  disabled?: boolean;
  loading?: boolean | { delay?: number };
  className?: string;
  ghost?: boolean;
  danger?: boolean;
  block?: boolean;
  children?: any;
  htmlType?: ButtonHTMLType;
  ref?: any;
  onClick?: (e: Event) => void
};

type Loading = number | boolean;

const InternalButton = (props: BaseButtonProps) => {
  const {
    loading = false,
    type = 'default',
    danger,
    shape = 'default',
    disabled: customDisabled,
    className,
    children,
    icon,
    ghost = false,
    block = false,
    /** If we extract items here, we don't need use omit.js */
    // React does not recognize the `htmlType` prop on a DOM element. Here we pick it out of `rest`.
    htmlType = 'button' as ButtonHTMLType,
    ref,
    ...rest
  } = props;

  // ===================== Disabled =====================
  const mergedDisabled = customDisabled ?? false;

  const [innerLoading, setLoading] = useState<Loading>(!!loading);
  const buttonRef = (ref as any) || createRef<HTMLElement>();


  // =============== Update Loading ===============
  const loadingOrDelay: Loading = typeof loading === 'boolean' ? loading : loading?.delay || true;

  useEffect(() => {
    let delayTimer: number | null = null;

    if (typeof loadingOrDelay === 'number') {
      delayTimer = window.setTimeout(() => {
        delayTimer = null;
        setLoading(loadingOrDelay);
      }, loadingOrDelay);
    } else {
      setLoading(loadingOrDelay);
    }

    return () => {
      if (delayTimer) {
        // in order to not perform a React state update on an unmounted component
        // and clear timer after 'loadingOrDelay' updated.
        window.clearTimeout(delayTimer);
        delayTimer = null;
      }
    };
  }, [loadingOrDelay]);

  useEffect(() => {
    // Todo
    console.log(buttonRef);
  }, [buttonRef]);

  const handleClick = (e: any) => {
    const { onClick } = props;
    // https://github.com/ant-design/ant-design/issues/30207
    if (innerLoading || mergedDisabled) {
      console.log('preventDefault');
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const iconType = innerLoading ? 'loading' : icon;

  const classes = classNames(
    prefixCls,
    {
      [`${prefixCls}-${shape}`]: shape !== 'default' && shape, // Note: Shape also has `default`
      [`${prefixCls}-${type}`]: type,
      [`${prefixCls}-icon-only`]: !children && !!iconType,
      [`${prefixCls}-background-ghost`]: ghost && !isUnBorderedButtonType(type),
      [`${prefixCls}-loading`]: innerLoading,
      [`${prefixCls}-block`]: block,
      [`${prefixCls}-dangerous`]: !!danger,
      [`${prefixCls}-disabled`]:  mergedDisabled,
    },
    className,
  );

  const iconNode =
    icon && !innerLoading ?
      icon
     : <LoadingIcon existIcon={!!icon} prefixCls={prefixCls} loading={!!innerLoading} />;

  return (<button
      {...rest}
      type={htmlType}
      className={classes}
      onClick={handleClick}
      disabled={mergedDisabled}
      ref={buttonRef}
    >
      { iconNode }
      {children}
    </button>
  );
};

const Button = InternalButton;


// Button.Group = Group;
// Button.__ANT_BUTTON = true;

export default Button;
