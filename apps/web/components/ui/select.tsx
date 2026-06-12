"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

type SelectOption = {
  disabled: boolean;
  label: string;
  value: string;
};

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  emptyMessage?: string;
  leadingIcon?: React.ReactNode;
  menuClassName?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  triggerClassName?: string;
  wrapperClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      children,
      className,
      disabled,
      emptyMessage = "No options found.",
      leadingIcon,
      menuClassName,
      onBlur,
      onChange,
      onSearchChange,
      placeholder = "Select",
      searchable = false,
      searchPlaceholder = "Search options",
      searchValue,
      triggerClassName,
      id,
      value,
      defaultValue,
      wrapperClassName,
      ...props
    },
    forwardedRef
  ) => {
    const options = React.useMemo(() => parseOptions(children), [children]);
    const isControlled = value !== undefined;
    const [isOpen, setIsOpen] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState(
      String(defaultValue ?? options[0]?.value ?? "")
    );
    const [internalSearchValue, setInternalSearchValue] = React.useState("");
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const selectRef = React.useRef<HTMLSelectElement | null>(null);
    const nativeSelectId = id ? `${id}-native` : undefined;

    const selectedValue = String(isControlled ? value ?? "" : internalValue);
    const resolvedSearchValue = searchValue ?? internalSearchValue;
    const selectedOption =
      options.find((option) => option.value === selectedValue) ?? options[0];
    const visibleOptions = React.useMemo(() => {
      if (!searchable) {
        return options;
      }

      const query = resolvedSearchValue.trim().toLowerCase();
      if (!query) {
        return options;
      }

      return options.filter((option) =>
        option.label.toLowerCase().includes(query)
      );
    }, [options, resolvedSearchValue, searchable]);

    React.useEffect(() => {
      if (isControlled || options.length === 0) {
        return;
      }

      if (!options.some((option) => option.value === internalValue)) {
        setInternalValue(String(defaultValue ?? options[0]?.value ?? ""));
      }
    }, [defaultValue, internalValue, isControlled, options]);

    React.useEffect(() => {
      if (!isOpen) {
        if (searchValue === undefined) {
          setInternalSearchValue("");
        }
        return;
      }

      if (searchable) {
        window.requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        });
      }

      function handlePointerDown(event: PointerEvent) {
        if (
          wrapperRef.current &&
          !wrapperRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      }

      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Escape") {
          setIsOpen(false);
        }
      }

      document.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("pointerdown", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [isOpen, searchable, searchValue]);

    function setSelectRefs(node: HTMLSelectElement | null) {
      selectRef.current = node;

      if (typeof forwardedRef === "function") {
        forwardedRef(node);
        return;
      }

      if (forwardedRef) {
        forwardedRef.current = node;
      }
    }

    function updateValue(nextValue: string) {
      if (!isControlled) {
        setInternalValue(nextValue);
      }

      if (selectRef.current) {
        selectRef.current.value = nextValue;
      }

      onChange?.({
        currentTarget: {
          name: props.name,
          value: nextValue
        },
        target: {
          name: props.name,
          value: nextValue
        }
      } as React.ChangeEvent<HTMLSelectElement>);
    }

    function updateSearchValue(nextValue: string) {
      if (searchValue === undefined) {
        setInternalSearchValue(nextValue);
      }
      onSearchChange?.(nextValue);
    }

    function handleOptionSelect(option: SelectOption) {
      if (option.disabled || disabled) {
        return;
      }

      updateValue(option.value);
      setIsOpen(false);
    }

    return (
      <div className={cn("relative min-w-0", wrapperClassName)} ref={wrapperRef}>
        <select
          {...props}
          aria-hidden="true"
          className="sr-only"
          defaultValue={undefined}
          disabled={disabled}
          id={nativeSelectId}
          onBlur={onBlur}
          onChange={(event) => {
            if (!isControlled) {
              setInternalValue(event.target.value);
            }
            onChange?.(event);
          }}
          ref={setSelectRefs}
          tabIndex={-1}
          value={selectedValue}
        >
          {children}
        </select>
        <button
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={props["aria-label"]}
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-xl border border-[color:var(--sn-border)] bg-white/90 px-3 text-left text-sm font-medium text-[color:var(--sn-body)] shadow-sm outline-none transition hover:border-primary/30 hover:bg-white focus-visible:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60",
            className,
            triggerClassName
          )}
          disabled={disabled}
          id={id}
          onBlur={(event) => {
            onBlur?.({
              ...event,
              currentTarget: selectRef.current,
              target: selectRef.current
            } as unknown as React.FocusEvent<HTMLSelectElement>);
          }}
          onClick={() => setIsOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter") {
              event.preventDefault();
              setIsOpen(true);
            }
          }}
          type="button"
        >
          {leadingIcon ? (
            <span className="grid h-5 w-5 shrink-0 place-items-center text-primary">
              {leadingIcon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate">
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[color:var(--sn-muted)] transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen ? (
          <div
            className={cn(
              "absolute left-0 top-full z-50 mt-1 max-h-72 w-full min-w-full overflow-y-auto rounded-xl border border-[color:var(--sn-border)] bg-white p-1 text-sm shadow-[0_18px_45px_rgba(65,21,23,0.16)]",
              menuClassName
            )}
            role="listbox"
          >
            {searchable ? (
              <div className="sticky top-0 z-10 bg-white p-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[color:var(--sn-muted)]" />
                  <input
                    aria-label={searchPlaceholder}
                    className="h-10 w-full rounded-lg border border-[color:var(--sn-border)] bg-white pl-9 pr-3 text-sm text-[color:var(--sn-ink)] outline-none transition placeholder:text-[color:var(--sn-muted)] focus:border-primary/35 focus:ring-2 focus:ring-primary/15"
                    onChange={(event) => updateSearchValue(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder={searchPlaceholder}
                    ref={searchInputRef}
                    value={resolvedSearchValue}
                  />
                </div>
              </div>
            ) : null}
            {visibleOptions.map((option) => {
              const selected = option.value === selectedValue;

              return (
                <button
                  aria-selected={selected}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[color:var(--sn-body)] outline-none transition hover:bg-primary/10 hover:text-[color:var(--sn-ink)] focus-visible:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-45",
                    selected && "bg-primary/10 text-[color:var(--sn-ink)]"
                  )}
                  disabled={option.disabled}
                  key={option.value}
                  onClick={() => handleOptionSelect(option)}
                  role="option"
                  type="button"
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              );
            })}
            {!visibleOptions.length ? (
              <div className="px-3 py-3 text-sm text-[color:var(--sn-muted)]">
                {emptyMessage}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select };

function parseOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }

    if (child.type === React.Fragment) {
      const fragment = child as React.ReactElement<{
        children?: React.ReactNode;
      }>;
      options.push(...parseOptions(fragment.props.children));
      return;
    }

    if (child.type !== "option") {
      return;
    }

    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
    const value = String(props.value ?? getOptionText(props.children));

    options.push({
      disabled: Boolean(props.disabled),
      label: getOptionText(props.children),
      value
    });
  });

  return options;
}

function getOptionText(children: React.ReactNode): string {
  if (children === null || children === undefined) {
    return "";
  }

  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(getOptionText).join("");
  }

  return String(children);
}
