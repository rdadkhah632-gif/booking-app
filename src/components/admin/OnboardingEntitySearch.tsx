import {
  Building2,
  Check,
  MapPin,
  Search,
  Sparkles,
  UserRoundPlus,
  X,
} from "lucide-react";
import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export type OnboardingSuggestion = {
  type: "directory" | "business" | "onboarding";
  id: string;
  name: string;
  city?: string | null;
  categoryKey?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  socialUrl?: string | null;
  state: string;
  claimStatus?: string | null;
  linkedBusinessId?: string | null;
  ownerName?: string | null;
  caseId?: string | null;
  onboardingStatus?: string | null;
};

type Copy = {
  label: string;
  placeholder: string;
  hint: string;
  searching: string;
  noMatches: string;
  directory: string;
  business: string;
  onboarding: string;
  existingCase: string;
  newProspect: string;
  clear: string;
  stateLabels: Record<string, string>;
};

type Props = {
  value: string;
  suggestions: OnboardingSuggestion[];
  loading: boolean;
  selected: OnboardingSuggestion | null;
  copy: Copy;
  onChange: (value: string) => void;
  onSelect: (suggestion: OnboardingSuggestion) => void;
  onCreate: (name: string) => void;
  onClear: () => void;
};

function sourceLabel(suggestion: OnboardingSuggestion, copy: Copy) {
  if (suggestion.type === "directory") return copy.directory;
  if (suggestion.type === "business") return copy.business;
  return copy.onboarding;
}

function SourceIcon({ type }: { type: OnboardingSuggestion["type"] }) {
  if (type === "directory") return <MapPin aria-hidden="true" />;
  if (type === "business") return <Building2 aria-hidden="true" />;
  return <Sparkles aria-hidden="true" />;
}

export default function OnboardingEntitySearch({
  value,
  suggestions,
  loading,
  selected,
  copy,
  onChange,
  onSelect,
  onCreate,
  onClear,
}: Props) {
  const listId = useId();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const canCreate = value.trim().length >= 2;
  const optionCount = suggestions.length + (canCreate ? 1 : 0);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!shellRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
    if (value.trim().length >= 2 && !selected) setOpen(true);
  }, [suggestions, value, selected]);

  function activate(index: number) {
    if (index < suggestions.length) {
      onSelect(suggestions[index]);
    } else if (canCreate) {
      onCreate(value.trim());
    }
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        if (optionCount === 0) return -1;
        if (current < 0) return direction > 0 ? 0 : optionCount - 1;
        return (current + direction + optionCount) % optionCount;
      });
      return;
    }
    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      activate(activeIndex);
    }
  }

  return (
    <div className="entity-search" ref={shellRef}>
      <label htmlFor={`${listId}-input`}>{copy.label}</label>
      <div className="entity-search-input">
        <Search aria-hidden="true" />
        <input
          id={`${listId}-input`}
          value={value}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          placeholder={copy.placeholder}
          onFocus={() => {
            if (value.trim().length >= 2 && !selected) setOpen(true);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(event.target.value.trim().length >= 2);
          }}
          onKeyDown={handleKeyDown}
        />
        {(value || selected) && (
          <button type="button" onClick={onClear} aria-label={copy.clear}>
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      <p>{copy.hint}</p>

      {selected && (
        <div className="selected-entity" aria-live="polite">
          <SourceIcon type={selected.type} />
          <span>
            <strong>{selected.name}</strong>
            <small>
              {sourceLabel(selected, copy)}
              {selected.city ? ` · ${selected.city}` : ""}
            </small>
          </span>
          <Check aria-hidden="true" />
        </div>
      )}

      {open && !selected && (
        <div className="entity-search-menu" id={listId} role="listbox">
          {loading && <div className="search-state">{copy.searching}</div>}
          {!loading && suggestions.length === 0 && (
            <div className="search-state">{copy.noMatches}</div>
          )}
          {!loading &&
            suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.id}`}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={activeIndex === index ? "active" : ""}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => activate(index)}
              >
                <SourceIcon type={suggestion.type} />
                <span className="suggestion-copy">
                  <span className="suggestion-heading">
                    <strong>{suggestion.name}</strong>
                    <em>{sourceLabel(suggestion, copy)}</em>
                  </span>
                  <small>
                    {[suggestion.city, suggestion.address, suggestion.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  <span className="suggestion-state">
                    <span>
                      {copy.stateLabels[suggestion.state] ||
                        suggestion.state.replaceAll("_", " ")}
                    </span>
                    {suggestion.caseId && <span>{copy.existingCase}</span>}
                  </span>
                </span>
              </button>
            ))}
          {canCreate && !loading && (
            <button
              id={`${listId}-${suggestions.length}`}
              type="button"
              role="option"
              aria-selected={activeIndex === suggestions.length}
              className={`create-option ${
                activeIndex === suggestions.length ? "active" : ""
              }`}
              onMouseEnter={() => setActiveIndex(suggestions.length)}
              onClick={() => activate(suggestions.length)}
            >
              <UserRoundPlus aria-hidden="true" />
              <span>
                <strong>{copy.newProspect}</strong>
                <small>{value.trim()}</small>
              </span>
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .entity-search {
          position: relative;
        }

        label {
          display: block;
          margin-bottom: 0.45rem;
          font-weight: 800;
        }

        .entity-search-input {
          min-height: 3rem;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.65rem;
          padding: 0 0.7rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .entity-search-input:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(237, 90, 42, 0.16);
        }

        .entity-search-input :global(svg) {
          width: 1.1rem;
          height: 1.1rem;
          color: var(--muted);
        }

        input {
          min-width: 0;
          width: 100%;
          min-height: 2.85rem;
          padding: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--text);
        }

        input::-webkit-search-cancel-button {
          display: none;
        }

        .entity-search-input button {
          width: 2.75rem;
          height: 2.75rem;
          display: inline-grid;
          place-items: center;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
        }

        .entity-search > p {
          margin: 0.42rem 0 0;
          color: var(--muted);
          font-size: 0.82rem;
        }

        .selected-entity {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.7rem;
          margin-top: 0.7rem;
          padding: 0.7rem 0.8rem;
          border: 1px solid rgba(15, 143, 131, 0.42);
          border-radius: 8px;
          background: rgba(15, 143, 131, 0.09);
        }

        .selected-entity :global(svg) {
          width: 1.05rem;
          height: 1.05rem;
          color: #0f8f83;
        }

        .selected-entity span {
          min-width: 0;
          display: grid;
          gap: 0.15rem;
        }

        .selected-entity strong,
        .selected-entity small {
          overflow-wrap: anywhere;
        }

        .selected-entity small {
          color: var(--muted);
        }

        .entity-search-menu {
          position: absolute;
          top: calc(100% + 0.45rem);
          left: 0;
          right: 0;
          z-index: 80;
          max-height: min(29rem, 66vh);
          overflow-y: auto;
          padding: 0.4rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          box-shadow: 0 1.1rem 3rem rgba(0, 0, 0, 0.25);
        }

        .entity-search-menu button {
          width: 100%;
          min-height: 3.6rem;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: start;
          gap: 0.65rem;
          padding: 0.7rem;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          text-align: left;
          cursor: pointer;
        }

        .entity-search-menu button:hover,
        .entity-search-menu button.active {
          border-color: rgba(15, 143, 131, 0.35);
          background: rgba(15, 143, 131, 0.08);
        }

        .entity-search-menu button :global(svg) {
          width: 1.05rem;
          height: 1.05rem;
          margin-top: 0.12rem;
          color: #0f8f83;
        }

        .suggestion-copy,
        .entity-search-menu .create-option > span {
          min-width: 0;
          display: grid;
          gap: 0.28rem;
        }

        .suggestion-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.65rem;
        }

        .suggestion-heading strong,
        .suggestion-copy small {
          overflow-wrap: anywhere;
        }

        .suggestion-heading em,
        .suggestion-state span {
          flex: 0 0 auto;
          padding: 0.14rem 0.35rem;
          border-radius: 999px;
          background: var(--surface-3);
          color: var(--muted);
          font-size: 0.7rem;
          font-style: normal;
          font-weight: 800;
        }

        .suggestion-copy small,
        .create-option small {
          color: var(--muted);
          line-height: 1.35;
        }

        .suggestion-state {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
        }

        .search-state {
          padding: 0.85rem;
          color: var(--muted);
        }

        @media (max-width: 560px) {
          .suggestion-heading {
            display: grid;
            justify-content: start;
          }

          .suggestion-heading em {
            width: fit-content;
          }
        }
      `}</style>
    </div>
  );
}
