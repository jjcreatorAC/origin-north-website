<?php
/*
  Receives a project brief from /brief/ and emails it to Origin North.

  The site is static, but Hostinger runs PHP, so this one script sends each
  brief from our own server straight to the inbox: no outside form service,
  no activation step. The email has a plain-text and an HTML version, and
  replying to it answers the person who wrote the brief.

  GET answers {"ok": true, ...} so you can check the script runs, and says
  whether it can see each visitor's own address behind Hostinger's CDN.
*/

declare(strict_types=1);

const TO = 'info@originnorth.dk';
const FROM = 'info@originnorth.dk';
const LIMIT_PER_HOUR = 20;

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

// The visitor's own address. Behind Hostinger's CDN the connection comes from the CDN,
// which passes the visitor's address along in a header.
function visitor(): array
{
    foreach (['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CF_CONNECTING_IP'] as $header) {
        $ip = trim(explode(',', $_SERVER[$header] ?? '')[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return [$ip, true];
        }
    }
    return [$_SERVER['REMOTE_ADDR'] ?? 'unknown', false];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    reply(200, ['ok' => true, 'mail' => function_exists('mail'), 'client' => visitor()[1] ? 'forwarded' : 'direct']);
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

// A few briefs an hour from one person is plenty; more is someone hammering the form.
// Without the visitor's own address every brief would seem to come from the CDN, so
// then each email address counts on its own instead.
[$ip, $forwarded] = visitor();
$sender = $forwarded ? $ip : $ip . '|' . strtolower($brief['email']);
$store = sys_get_temp_dir() . '/origin-north-briefs.json';
$handle = fopen($store, 'c+');
if ($handle && flock($handle, LOCK_EX)) {
    $log = json_decode(stream_get_contents($handle) ?: '[]', true) ?: [];
    $key = hash('sha256', 'v2|' . $sender);
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

// The email reads like one the visitor wrote themselves: their message first, their
// details as a signature, their name as the sender and their address to reply to.
// The sending address stays ours, because mail providers turn away messages that
// claim to come from someone else's address.
$signature = array_values(array_filter([$brief['name'], $brief['company'], $brief['email'], $brief['phone']]));
$about = [
    'Needs help with' => implode(', ', $brief['needs']),
    'Hoping to start' => $brief['timing'],
];
$subject = 'Project brief: ' . implode(', ', $brief['needs']);

$plain = $brief['message'] . "\n\n" . implode("\n", $signature) . "\n\n";
foreach ($about as $label => $value) {
    $plain .= "{$label}: {$value}\n";
}
$plain .= "\nSent from the project brief on originnorth.dk\n";

$sign = implode('<br>', array_map(
    static fn (string $value): string => $value === $brief['email'] ? '<a href="mailto:' . $e($value) . '" style="color:#1a5fb4">' . $e($value) . '</a>' : $e($value),
    $signature,
));
$facts = implode('<br>', array_map(static fn (string $label, string $value): string => $e($label) . ': ' . $e($value), array_keys($about), $about));
$html = '<!doctype html><html><body style="margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f">'
    . formatted($brief['message'], $e)
    . '<p style="margin:24px 0 0;color:#444">' . $sign . '</p>'
    . '<p style="margin:16px 0 0;color:#444">' . $facts . '</p>'
    . '<p style="margin:24px 0 0;color:#8a8a8a;font-size:12px">Sent from the project brief on originnorth.dk</p>'
    . '</body></html>';

// Plain names go in quotes (so "Hansen, Mette" stays one name); others are encoded.
$named = static fn (string $name): string => preg_match('/^[\x20-\x7E]*$/', $name) ? '"' . addcslashes($name, '"\\') . '"' : mb_encode_mimeheader($name, 'UTF-8', 'B');
$boundary = 'brief-' . bin2hex(random_bytes(12));
$headers = [
    'From' => $named($brief['name'] . ' via Origin North') . ' <' . FROM . '>',
    'Reply-To' => $named($brief['name']) . ' <' . $brief['email'] . '>',
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
    // Shows up in Hostinger's PHP error log (hPanel, Advanced, PHP configuration).
    error_log('[brief] mail() refused the brief: ' . (error_get_last()['message'] ?? 'no details'));
    reply(502, ['success' => false, 'message' => 'The brief could not be emailed']);
}
reply(200, ['success' => true]);
