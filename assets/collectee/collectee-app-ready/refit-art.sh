#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_root="${1:-${script_dir}/../collectee-asset-pack}"
output_root="${2:-${script_dir}}"
manifest="${source_root}/asset-manifest.json"

for command_name in convert identify jq; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "Missing dependency: ${command_name}" >&2
    exit 1
  }
done

mkdir -p "${output_root}/images/subjects" "${output_root}/images/items"
find "${output_root}/images" -type f -name '*.tmp.png' -delete

cleanup_temp_files() {
  find "${output_root}/images" -type f -name '*.tmp.png' -delete
}
trap cleanup_temp_files EXIT

while IFS=$'\t' read -r relative_path focal_point; do
  input_path="${source_root}/${relative_path}"
  output_path="${output_root}/${relative_path}"
  temp_output="${output_path}.tmp.png"
  read -r source_width source_height < <(identify -format '%w %h\n' "${input_path}")

  focal_x="${focal_point%% *}"
  focal_y="${focal_point##* }"
  focal_x="${focal_x%%%}"
  focal_y="${focal_y%%%}"

  if (( source_width * 2 < source_height * 3 )); then
    crop_width="${source_width}"
    crop_height="$((source_width * 2 / 3))"
    crop_x=0
    crop_y="$(((source_height - crop_height) * focal_y / 100))"
  else
    crop_height="${source_height}"
    crop_width="$((source_height * 3 / 2))"
    crop_x="$(((source_width - crop_width) * focal_x / 100))"
    crop_y=0
  fi

  rm -f "${temp_output}"
  convert "${input_path}" \
    -crop "${crop_width}x${crop_height}+${crop_x}+${crop_y}" +repage \
    -filter Lanczos -resize '660x440!' -colorspace sRGB -strip \
    -define png:compression-level=9 "${temp_output}"
  identify "${temp_output}" >/dev/null
  mv -f "${temp_output}" "${output_path}"
done < <(jq -r '.assets[] | select(.assetType == "hero_skin") | [.file, .focalPoint] | @tsv' "${manifest}")

# Conservative per-object insets remove only dead outer margin. The objects
# remain fully visible inside a square and are never cover-cropped.
while IFS=$'\t' read -r asset_id relative_path; do
  input_path="${source_root}/${relative_path}"
  output_path="${output_root}/${relative_path}"
  temp_output="${output_path}.tmp.png"
  read -r source_width source_height < <(identify -format '%w %h\n' "${input_path}")

  case "${asset_id}" in
    dota2-arcana-relic) inset=30 ;;
    lol-voidblade) inset=60 ;;
    mlbb-neon-katana) inset=28 ;;
    mlbb-rose-crystal-charm) inset=72 ;;
    *) inset=28 ;;
  esac

  side="$((source_width < source_height ? source_width : source_height))"
  crop_side="$((side - inset * 2))"

  rm -f "${temp_output}"
  convert "${input_path}" \
    -crop "${crop_side}x${crop_side}+${inset}+${inset}" +repage \
    -filter Lanczos -resize '620x620!' -colorspace sRGB -strip \
    -define png:compression-level=9 "${temp_output}"
  identify "${temp_output}" >/dev/null
  mv -f "${temp_output}" "${output_path}"
done < <(jq -r '.assets[] | select(.assetType != "hero_skin") | [.id, .file] | @tsv' "${manifest}")

echo "App-ready art written to ${output_root}/images"
