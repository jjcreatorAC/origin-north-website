<?php
/*
  Receives a project brief from /brief/ and emails it to Origin North.

  The site is static, but Hostinger runs PHP, so this one script sends each
  brief from our own server straight to the inbox: no outside form service,
  no activation step. The email has a plain-text and an HTML version, and
  replying to it answers the person who wrote the brief.

  GET answers {"ok": true} so you can check the script runs.
*/

declare(strict_types=1);

const TO = 'info@originnorth.dk';
const FROM = 'info@originnorth.dk';
const LIMIT_PER_HOUR = 10;

const NEEDS = ['Website', 'App', 'Customer portal', 'Dashboard', 'Team management', 'Automation', 'Support and maintenance', 'Operations and coordination', 'Not sure yet'];
const TIMINGS = ['As soon as possible', 'Within three months', 'In three to six months', 'Just exploring for now'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reply(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    reply(200, ['ok' => true, 'mail' => function_exists('mail')]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    reply(405, ['success' => false, 'message' => 'Method not allowed']);
}

// Only the page's own script sends JSON; other sites can't without the browser asking first.
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
    reply(415, ['success' => false, 'message' => 'Send JSON']);
}

$raw = file_get_contents('php://input', false, null, 0, 65536);
$data = json_decode($raw ?: '', true);
if (!is_array($data)) {
    reply(400, ['success' => false, 'message' => 'Invalid request']);
}

$text = static fn (string $key, int $max): string => mb_substr(trim((string) ($data[$key] ?? '')), 0, $max);
// One line only: these values end up in mail headers.
$line = static fn (string $value): string => trim(preg_replace('/[\r\n\t]+/', ' ', $value));

$brief = [
    'name' => $line($text('name', 120)),
    'company' => $line($text('company', 160)),
    'email' => $line($text('email', 200)),
    'phone' => $line($text('phone', 60)),
    'timing' => $line($text('timing', 60)),
    'message' => str_replace("\r\n", "\n", $text('message', 8000)),
    'needs' => array_values(array_intersect(NEEDS, array_map('strval', (array) ($data['needs'] ?? [])))),
];

// Bots fill in the hidden field, or send faster than a person can type. Tell them
// it worked and send nothing.
if ($text('honey', 200) !== '' || (float) ($data['elapsed'] ?? 99) < 4) {
    reply(200, ['success' => true]);
}

if ($brief['name'] === '' || !filter_var($brief['email'], FILTER_VALIDATE_EMAIL) || mb_strlen($brief['message']) < 2 || !$brief['needs'] || !in_array($brief['timing'], TIMINGS, true)) {
    reply(422, ['success' => false, 'message' => 'Some answers are missing']);
}

// A few briefs an hour from one address is plenty; more is someone hammering the form.
$ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]) ?: ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$store = sys_get_temp_dir() . '/origin-north-briefs.json';
$handle = fopen($store, 'c+');
if ($handle && flock($handle, LOCK_EX)) {
    $log = json_decode(stream_get_contents($handle) ?: '[]', true) ?: [];
    $key = hash('sha256', $ip);
    $now = time();
    $log = array_filter(array_map(static fn ($times) => array_values(array_filter((array) $times, static fn ($t) => $t > $now - 3600)), $log));
    if (count($log[$key] ?? []) >= LIMIT_PER_HOUR) {
        flock($handle, LOCK_UN);
        reply(429, ['success' => false, 'message' => 'Too many briefs, please try again later']);
    }
    $log[$key][] = $now;
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($log));
    fflush($handle);
    flock($handle, LOCK_UN);
}
if ($handle) {
    fclose($handle);
}

/* ───── The email ───── */

$e = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');

// The brief's own formatting: **bold**, _italics_ and "• " bullets become HTML.
function formatted(string $text, callable $e): string
{
    $inline = static function (string $value) use ($e): string {
        $html = $e($value);
        $html = preg_replace('/\*\*(?=\S)(.+?)(?<=\S)\*\*/u', '<strong>$1</strong>', $html);
        return preg_replace('/(?<![\w])_(?=\S)(.+?)(?<=\S)_(?![\w])/u', '<em>$1</em>', $html);
    };
    $html = '';
    foreach (preg_split('/\n{2,}/', trim($text)) as $block) {
        $list = [];
        $lines = [];
        $flush = static function () use (&$list, &$lines, &$html): void {
            if ($lines) {
                $html .= '<p style="margin:0 0 14px">' . implode('<br>', $lines) . '</p>';
                $lines = [];
            }
            if ($list) {
                $html .= '<ul style="margin:0 0 14px;padding-left:20px">' . implode('', $list) . '</ul>';
                $list = [];
            }
        };
        foreach (explode("\n", $block) as $row) {
            if (str_starts_with($row, '• ')) {
                if ($lines) {
                    $flush();
                }
                $list[] = '<li style="margin:0 0 4px">' . $inline(mb_substr($row, 2)) . '</li>';
            } else {
                if ($list) {
                    $flush();
                }
                $lines[] = $inline($row);
            }
        }
        $flush();
    }
    return $html;
}

$who = $brief['company'] !== '' ? $brief['company'] : $brief['name'];
$first = explode(' ', $brief['name'])[0];
$subject = 'New project brief from ' . $who;

$details = [
    'Name' => $brief['name'],
    'Company' => $brief['company'] ?: 'Not given',
    'Email' => $brief['email'],
    'Phone' => $brief['phone'] ?: 'Not given',
    'Needs help with' => implode(', ', $brief['needs']),
    'Hoping to start' => $brief['timing'],
];

$plain = "New project brief from the website\n\n";
foreach ($details as $label => $value) {
    $plain .= "{$label}: {$value}\n";
}
$plain .= "\nAbout the project\n\n" . $brief['message'] . "\n\nReply to this email to answer {$first} directly.\n";

$rows = '';
foreach ($details as $label => $value) {
    $shown = $label === 'Email' ? '<a href="mailto:' . $e($value) . '" style="color:#863012">' . $e($value) . '</a>' : $e($value);
    $rows .= '<tr><td style="padding:6px 16px 6px 0;color:#8e4328;font-size:13px;white-space:nowrap;vertical-align:top">' . $e($label) . '</td><td style="padding:6px 0;color:#2a1a12;font-size:15px">' . $shown . '</td></tr>';
}
$html = '<!doctype html><html><body style="margin:0;padding:0;background:#f6efe9">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6efe9"><tr><td align="center" style="padding:32px 16px">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px">'
    . '<tr><td style="padding:32px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif">'
    . '<p style="margin:0 0 6px;color:#8e4328;font-size:12px;letter-spacing:.04em;text-transform:uppercase">Project brief</p>'
    . '<h1 style="margin:0 0 20px;color:#863012;font-size:24px;font-weight:600;line-height:1.25">' . $e($who) . '</h1>'
    . '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px">' . $rows . '</table>'
    . '<p style="margin:0 0 10px;color:#8e4328;font-size:12px;letter-spacing:.04em;text-transform:uppercase">About the project</p>'
    . '<div style="color:#2a1a12;font-size:15px;line-height:1.6">' . formatted($brief['message'], $e) . '</div>'
    . '</td></tr><tr><td style="padding:16px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;color:#8e4328;font-size:13px;border-top:1px solid #f1e3da">'
    . 'Reply to this email to answer ' . $e($first) . ' directly.</td></tr></table></td></tr></table></body></html>';

// Plain names go in quotes (so "Hansen, Mette" stays one name); others are encoded.
$display = preg_match('/^[\x20-\x7E]*$/', $brief['name']) ? '"' . addcslashes($brief['name'], '"\\') . '"' : mb_encode_mimeheader($brief['name'], 'UTF-8', 'B');
$boundary = 'brief-' . bin2hex(random_bytes(12));
$headers = [
    'From' => 'Origin North website <' . FROM . '>',
    'Reply-To' => $display . ' <' . $brief['email'] . '>',
    'MIME-Version' => '1.0',
    'Content-Type' => 'multipart/alternative; boundary="' . $boundary . '"',
];
$body = "--{$boundary}\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($plain))
    . "--{$boundary}\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($html))
    . "--{$boundary}--\r\n";

$sent = mail(TO, mb_encode_mimeheader($subject, 'UTF-8', 'B'), $body, $headers, '-f' . FROM);

if (!$sent) {
    reply(502, ['success' => false, 'message' => 'The brief could not be emailed']);
}
reply(200, ['success' => true]);
