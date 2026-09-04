#!/bin/sh

# Keep the mutation logic deterministic and make every outcome machine-readable.
set -u

PROJECT_ROOT=''
CLAUDE_PATH=''
AGENTS_PATH=''
BACKUP_PATH=''
TMP_FILE=''
ACTIONS_JSON=''

cleanup() {
  if [ -n "$TMP_FILE" ] && [ -e "$TMP_FILE" ]; then
    rm -f "$TMP_FILE"
  fi
}
trap cleanup 0 1 2 3 15

json_quote() {
  printf '%s' "$1" | awk 'BEGIN { ORS=""; printf "\"" }
    {
      gsub(/\\/, "\\\\")
      gsub(/"/, "\\\"")
      gsub(/\t/, "\\t")
      gsub(/\r/, "\\r")
      if (NR > 1) printf "\\n"
      printf "%s", $0
    }
    END { printf "\"" }'
}

add_action() {
  if [ -n "$ACTIONS_JSON" ]; then
    ACTIONS_JSON="$ACTIONS_JSON,$(json_quote "$1")"
  else
    ACTIONS_JSON=$(json_quote "$1")
  fi
}

actions_json() {
  printf '[%s]' "$ACTIONS_JSON"
}

finish() {
  status=$1
  state=$2
  reason=$3
  verification=$4
  printf '{"status":%s,"project_root":%s,"state":%s,"actions":%s,"backup_path":%s,"reason":%s,"verification":%s}\n' \
    "$(json_quote "$status")" \
    "$(json_quote "$PROJECT_ROOT")" \
    "$(json_quote "$state")" \
    "$(actions_json)" \
    "$(json_quote "$BACKUP_PATH")" \
    "$(json_quote "$reason")" \
    "$(json_quote "$verification")"
}

path_exists() {
  [ -e "$1" ] || [ -L "$1" ]
}

file_kind() {
  if ! path_exists "$1"; then
    printf 'absent'
  elif [ -f "$1" ] && [ ! -L "$1" ]; then
    printf 'regular'
  else
    printf 'other'
  fi
}

is_reference() {
  printf '%s\n' '@AGENTS.md' | cmp -s - "$1"
}

atomic_create_from_temp() {
  create_target=$1
  temp_source=$2
  if path_exists "$create_target"; then
    return 1
  fi
  if ! ln "$temp_source" "$create_target" 2>/dev/null; then
    return 1
  fi
  return 0
}

set_default_file_mode() {
  mode_target=$1
  mask=$(umask)
  case "$mask" in
    ''|*[!0-7]*)
      return 1
      ;;
  esac
  mask_value=$((0$mask))
  default_mode=$((0666 & ~mask_value))
  mode=$(printf '%03o' "$default_mode") || return 1
  chmod "$mode" "$mode_target"
}

create_new_text() {
  target=$1
  content=$2
  if path_exists "$target"; then
    return 1
  fi
  temp=$(mktemp "$PROJECT_ROOT/.agents-claude-md-sync.XXXXXX") || return 1
  if ! printf '%s' "$content" > "$temp"; then
    rm -f "$temp"
    return 1
  fi
  if ! set_default_file_mode "$temp"; then
    rm -f "$temp"
    return 1
  fi
  if ! atomic_create_from_temp "$target" "$temp"; then
    rm -f "$temp"
    return 1
  fi
  rm -f "$temp"
  return 0
}

create_new_from_file() {
  target=$1
  source=$2
  if path_exists "$target"; then
    return 1
  fi
  temp=$(mktemp "$PROJECT_ROOT/.agents-claude-md-sync.XXXXXX") || return 1
  if ! cat "$source" > "$temp"; then
    rm -f "$temp"
    return 1
  fi
  if ! set_default_file_mode "$temp"; then
    rm -f "$temp"
    return 1
  fi
  if ! atomic_create_from_temp "$target" "$temp"; then
    rm -f "$temp"
    return 1
  fi
  rm -f "$temp"
  return 0
}

choose_backup() {
  max=-1
  for candidate in "$PROJECT_ROOT/CLAUDE.md.bak" "$PROJECT_ROOT"/CLAUDE.md.bak.*; do
    if ! path_exists "$candidate"; then
      continue
    fi
    base=${candidate##*/}
    case "$base" in
      CLAUDE.md.bak)
        number=0
        ;;
      CLAUDE.md.bak.*)
        suffix=${base#CLAUDE.md.bak.}
        case "$suffix" in
          ''|*[!0-9]*)
            continue
            ;;
        esac
        number=$(printf '%s' "$suffix" | sed 's/^0*//')
        [ -n "$number" ] || number=0
        ;;
      *)
        continue
        ;;
    esac
    if [ "$max" -lt 0 ] || [ "$number" -gt "$max" ] 2>/dev/null; then
      max=$number
    fi
  done
  if [ "$max" -lt 0 ]; then
    BACKUP_PATH=$PROJECT_ROOT/CLAUDE.md.bak
  else
    BACKUP_PATH=$PROJECT_ROOT/CLAUDE.md.bak.$((max + 1))
  fi
}

backup_claude() {
  choose_backup
  if path_exists "$BACKUP_PATH"; then
    return 1
  fi
  TMP_FILE=$(mktemp "$PROJECT_ROOT/.agents-claude-md-sync.XXXXXX") || return 1
  if ! cp -p "$CLAUDE_PATH" "$TMP_FILE"; then
    rm -f "$TMP_FILE"
    TMP_FILE=''
    return 1
  fi
  if ! cmp -s "$CLAUDE_PATH" "$TMP_FILE"; then
    rm -f "$TMP_FILE"
    TMP_FILE=''
    return 1
  fi
  if ! ln "$TMP_FILE" "$BACKUP_PATH" 2>/dev/null; then
    rm -f "$TMP_FILE"
    TMP_FILE=''
    return 1
  fi
  if ! cmp -s "$CLAUDE_PATH" "$BACKUP_PATH"; then
    rm -f "$TMP_FILE"
    TMP_FILE=''
    return 1
  fi
  rm -f "$TMP_FILE"
  TMP_FILE=''
  return 0
}

rewrite_claude_reference() {
  TMP_FILE=$(mktemp "$PROJECT_ROOT/.agents-claude-md-sync.XXXXXX") || return 1
  if ! cp -p "$CLAUDE_PATH" "$TMP_FILE"; then
    rm -f "$TMP_FILE"
    TMP_FILE=''
    return 1
  fi
  if ! printf '%s\n' '@AGENTS.md' > "$TMP_FILE"; then
    rm -f "$TMP_FILE"
    TMP_FILE=''
    return 1
  fi
  if ! is_reference "$TMP_FILE"; then
    rm -f "$TMP_FILE"
    TMP_FILE=''
    return 1
  fi
  if [ "$(file_kind "$CLAUDE_PATH")" != regular ]; then
    rm -f "$TMP_FILE"
    TMP_FILE=''
    return 1
  fi
  if ! mv "$TMP_FILE" "$CLAUDE_PATH"; then
    rm -f "$TMP_FILE"
    TMP_FILE=''
    return 1
  fi
  TMP_FILE=''
  is_reference "$CLAUDE_PATH"
}

if [ "$#" -gt 1 ]; then
  finish error invalid_arguments too_many_arguments failed
  exit 2
fi

TARGET=${1:-.}
if ! cd "$TARGET" 2>/dev/null; then
  finish error invalid_project_root project_root_unavailable failed
  exit 2
fi
PROJECT_ROOT=$(pwd -P 2>/dev/null) || {
  finish error invalid_project_root project_root_unavailable failed
  exit 2
}
CLAUDE_PATH=$PROJECT_ROOT/CLAUDE.md
AGENTS_PATH=$PROJECT_ROOT/AGENTS.md

agents_kind=$(file_kind "$AGENTS_PATH")
claude_kind=$(file_kind "$CLAUDE_PATH")
if [ "$agents_kind" = other ] || [ "$claude_kind" = other ]; then
  finish blocked invalid_entry non_regular_file failed
  exit 1
fi

if [ "$agents_kind" = regular ] && is_reference "$AGENTS_PATH"; then
  finish blocked invalid_source agents_self_reference failed
  exit 1
fi

if [ "$agents_kind" = absent ] && [ "$claude_kind" = absent ]; then
  finish notice neither both_missing passed
  exit 0
fi

if [ "$agents_kind" = regular ] && [ "$claude_kind" = absent ]; then
  if ! create_new_text "$CLAUDE_PATH" '@AGENTS.md
'; then
    finish error agents_only claude_create_failed failed
    exit 1
  fi
  if ! is_reference "$CLAUDE_PATH"; then
    finish error agents_only claude_verification_failed failed
    exit 1
  fi
  add_action created_claude_reference
  finish changed agents_only created_claude passed
  exit 0
fi

if [ "$agents_kind" = regular ] && [ "$claude_kind" = regular ]; then
  if is_reference "$CLAUDE_PATH"; then
    finish notice both_synced already_synced passed
    exit 0
  fi
  if cmp -s "$AGENTS_PATH" "$CLAUDE_PATH"; then
    if ! backup_claude; then
      finish error both_equal backup_failed failed
      exit 1
    fi
    add_action "created_backup:$BACKUP_PATH"
    if ! rewrite_claude_reference; then
      finish error both_equal claude_rewrite_failed failed
      exit 1
    fi
    add_action rewritten_claude_reference
    if ! is_reference "$CLAUDE_PATH" || ! cmp -s "$BACKUP_PATH" "$AGENTS_PATH"; then
      finish error both_equal post_verification_failed failed
      exit 1
    fi
    finish changed both_equal synchronized passed
    exit 0
  fi
  finish conflict both_conflict contents_differ not_run
  exit 1
fi

if [ "$agents_kind" = absent ] && [ "$claude_kind" = regular ]; then
  if is_reference "$CLAUDE_PATH"; then
    finish blocked claude_only_missing_source missing_agents_for_reference failed
    exit 1
  fi
  if ! backup_claude; then
    finish error claude_only backup_failed failed
    exit 1
  fi
  add_action "created_backup:$BACKUP_PATH"
  if ! cmp -s "$CLAUDE_PATH" "$BACKUP_PATH"; then
    finish error claude_only source_changed_after_backup failed
    exit 1
  fi
  if ! create_new_from_file "$AGENTS_PATH" "$CLAUDE_PATH"; then
    finish error claude_only agents_create_failed failed
    exit 1
  fi
  add_action created_agents_from_claude
  if ! cmp -s "$AGENTS_PATH" "$BACKUP_PATH"; then
    finish error claude_only agents_verification_failed failed
    exit 1
  fi
  if ! rewrite_claude_reference; then
    finish error claude_only claude_rewrite_failed failed
    exit 1
  fi
  add_action rewritten_claude_reference
  if ! is_reference "$CLAUDE_PATH" || ! cmp -s "$AGENTS_PATH" "$BACKUP_PATH"; then
    finish error claude_only post_verification_failed failed
    exit 1
  fi
  finish changed claude_only synchronized passed
  exit 0
fi

finish error unsupported_state unsupported_state failed
exit 1
