#!/bin/sh
set -u
cd "$(dirname "$0")/../.."
expected=$(mktemp)
list=$(mktemp)
trap 'rm "$expected" "$list"' EXIT
find pages -type f -name '*.flx' ! -name '_*' | LC_ALL=C sort > "$list"
total=0
matched=0
missing=0
different=0
while IFS= read -r file; do
  total=$((total + 1))
  actual="tests/build-actual/sections/$file"
  if ! test -f "$actual"; then
    printf 'MISSING_SECTION: %s\n' "$file"
    missing=$((missing + 1))
    continue
  fi
  perl -0777 -e '
    my ($file, $golden) = @ARGV;
    local $/;
    open my $fh, "<", $golden or die $!;
    my $all = <$fh>;
    my $marker = "; ── $file ──\n";
    my $start = index($all, $marker);
    die "missing golden section: $file\n" if $start < 0;
    my $body = substr($all, $start + length($marker));
    my $next = index($body, "\n; ── pages/");
    $next = index($body, "\n(server-get \"") if $next < 0;
    die "missing end of golden section: $file\n" if $next < 0;
    print substr($body, 0, $next + 1);
  ' "$file" tests/build-golden/_app.fl > "$expected"
  if cmp "$expected" "$actual"; then
    matched=$((matched + 1))
  else
    different=$((different + 1))
  fi
done < "$list"
printf 'SECTION_TOTAL=%s\nSECTION_MATCHED=%s\nSECTION_MISSING=%s\nSECTION_DIFFERENT=%s\n' \
  "$total" "$matched" "$missing" "$different"
test "$missing" -eq 0 && test "$different" -eq 0
