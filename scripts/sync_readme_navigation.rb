#!/usr/bin/env ruby
# frozen_string_literal: true

require "yaml"
require "date"

ROOT = File.expand_path("..", __dir__)
README_PATH = File.join(ROOT, "README.md")
NAVIGATION_PATH = File.join(ROOT, "_data", "navigation.yml")
CONFIG_PATH = File.join(ROOT, "_config.yml")

SECTIONS_START = "<!-- AUTO-GENERATED:SECTIONS:START -->"
SECTIONS_END = "<!-- AUTO-GENERATED:SECTIONS:END -->"
CONTENTS_START = "<!-- AUTO-GENERATED:CONTENTS:START -->"
CONTENTS_END = "<!-- AUTO-GENERATED:CONTENTS:END -->"

def parse_yaml(source, filename)
  YAML.safe_load(
    source,
    permitted_classes: [Date, Time],
    aliases: true,
    filename: filename
  ) || {}
end

def load_yaml_file(path)
  parse_yaml(File.read(path, encoding: "UTF-8"), path)
end

def front_matter(path)
  source = File.read(path, encoding: "UTF-8")
  match = source.match(/\A---\s*\n(.*?)\n---\s*\n/m)
  return {} unless match

  parse_yaml(match[1], path)
end

def markdown_path_for_url(url)
  clean = url.to_s.sub(%r{\A/}, "").sub(%r{/\z}, "")
  return "index.md" if clean.empty?

  file_candidate = "#{clean}.md"
  index_candidate = File.join(clean, "index.md")
  return file_candidate if File.file?(File.join(ROOT, file_candidate))
  return index_candidate if File.file?(File.join(ROOT, index_candidate))

  raise "Navigation URL has no Markdown source: #{url}"
end

def inferred_nav_section(relative_path, defaults)
  match = defaults
          .select do |entry|
            scope = entry.fetch("scope", {})["path"].to_s.sub(%r{/\z}, "")
            !scope.empty? && (relative_path == scope || relative_path.start_with?("#{scope}/"))
          end
          .max_by { |entry| entry.fetch("scope", {})["path"].to_s.length }

  match&.fetch("values", {})&.fetch("nav_section", nil)
end

def page_records(config)
  defaults = config.fetch("defaults", []).select do |entry|
    entry.fetch("values", {}).key?("nav_section")
  end

  Dir.glob(File.join(ROOT, "**", "*.md")).map do |path|
    relative_path = path.delete_prefix("#{ROOT}/")
    next if relative_path == "README.md"
    next if relative_path.start_with?("reference/", "_site/", "vendor/")

    metadata = front_matter(path)
    next if metadata.empty?

    nav_section = metadata["nav_section"] || inferred_nav_section(relative_path, defaults)
    next unless nav_section

    {
      "path" => relative_path,
      "metadata" => metadata,
      "nav_section" => nav_section
    }
  end.compact
end

def display_description(metadata)
  value = metadata["description_zh"] || metadata["description"]
  value.to_s.gsub(/\s+/, " ").strip
end

def render_item(label:, path:, description:, number:)
  prefix = number ? format("%02d｜", number) : ""
  suffix = description.empty? ? "" : " — #{description}"
  "- [#{prefix}#{label}](#{path})#{suffix}"
end

def render_explicit_section(section)
  counter = 0
  output = []
  groups = section["groups"] || [{ "items" => section.fetch("items", []) }]

  groups.each do |group|
    group_label = group["label_zh"] || group["label"]
    output << "#### #{group_label}" if group_label
    output << "" if group_label

    group.fetch("items", []).each do |item|
      counter += 1 if section["numbered"]
      path = markdown_path_for_url(item.fetch("url"))
      metadata = front_matter(File.join(ROOT, path))
      label = item["label_zh"] || item.fetch("label")
      output << render_item(
        label: label,
        path: path,
        description: display_description(metadata),
        number: section["numbered"] ? counter : nil
      )
    end

    output << ""
  end

  output
end

def render_dynamic_section(section, records)
  section_index_path = markdown_path_for_url(section.fetch("url"))
  pages = records
          .select { |record| record["nav_section"] == section.fetch("id") }
          .reject { |record| record["path"] == section_index_path }
          .sort_by do |record|
            metadata = record["metadata"]
            [metadata.fetch("nav_order", 1_000_000).to_i, metadata.fetch("title", "").to_s]
          end

  pages.each_with_index.map do |record, index|
    metadata = record["metadata"]
    label = metadata["nav_title_zh"] || metadata["nav_title"] || metadata.fetch("title")
    render_item(
      label: label,
      path: record["path"],
      description: display_description(metadata),
      number: section["numbered"] ? index + 1 : nil
    )
  end + [""]
end

def render_sections(navigation)
  navigation.map do |section|
    label = section["label_zh"] || section.fetch("label")
    path = markdown_path_for_url(section.fetch("url"))
    "- [#{section.fetch("index")} · #{label}](#{path})"
  end.join("\n")
end

def render_contents(navigation, records)
  lines = []

  navigation.each do |section|
    label = section["label_zh"] || section.fetch("label")
    section_path = markdown_path_for_url(section.fetch("url"))
    lines << "### [#{section.fetch("index")} · #{label}](#{section_path})"
    lines << ""
    lines.concat(
      if section["groups"] || section["items"]
        render_explicit_section(section)
      else
        render_dynamic_section(section, records)
      end
    )
  end

  lines.pop while lines.last == ""
  lines.join("\n")
end

def replace_generated_block(source, start_marker, end_marker, generated)
  pattern = /#{Regexp.escape(start_marker)}\n.*?\n#{Regexp.escape(end_marker)}/m
  raise "Missing README markers: #{start_marker} / #{end_marker}" unless source.match?(pattern)

  source.sub(pattern, "#{start_marker}\n#{generated}\n#{end_marker}")
end

navigation = load_yaml_file(NAVIGATION_PATH)
config = load_yaml_file(CONFIG_PATH)
records = page_records(config)
original = File.read(README_PATH, encoding: "UTF-8")

generated = replace_generated_block(
  original,
  SECTIONS_START,
  SECTIONS_END,
  render_sections(navigation)
)
generated = replace_generated_block(
  generated,
  CONTENTS_START,
  CONTENTS_END,
  render_contents(navigation, records)
)

if ARGV.include?("--check")
  if generated == original
    puts "README navigation is synchronized."
    exit 0
  end

  warn "README navigation is out of date. Run: ruby scripts/sync_readme_navigation.rb"
  exit 1
end

if generated == original
  puts "README navigation is already synchronized."
else
  File.write(README_PATH, generated, mode: "w", encoding: "UTF-8")
  puts "README navigation synchronized."
end
