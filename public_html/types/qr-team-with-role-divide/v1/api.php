<?php

declare(strict_types=1);

final class ApiError extends RuntimeException
{
    public int $status;

    public function __construct(string $message, int $status = 400)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function respond_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function now_ms(): int
{
    return (int) round(microtime(true) * 1000);
}

function ensure_storage_dir(string $path): ?string
{
    if ($path === '') {
        return null;
    }
    if (!is_dir($path) && !mkdir($path, 0777, true) && !is_dir($path)) {
        return null;
    }
    if (!is_writable($path)) {
        return null;
    }
    return $path;
}

function store_root(): string
{
    static $resolved = null;
    if (is_string($resolved) && $resolved !== '') {
        return $resolved;
    }

    $candidates = [];

    $envPath = trim((string) getenv('LEARNING_TOOLS_QR_TEAM_STORAGE'));
    if ($envPath !== '') {
        $candidates[] = $envPath;
    }

    $candidates[] = __DIR__ . '/runtime-data';

    $tempDir = trim(sys_get_temp_dir());
    if ($tempDir !== '') {
        $candidates[] = rtrim($tempDir, '/\\') . '/learning-tools-qr-team-with-role-divide';
    }

    foreach ($candidates as $candidate) {
        $resolvedPath = ensure_storage_dir($candidate);
        if ($resolvedPath !== null) {
            $resolved = $resolvedPath;
            return $resolved;
        }
    }

    throw new ApiError('Kan geen opslagmap aanmaken of gebruiken voor sessies.', 500);
}

function uploads_root(): string
{
    $path = store_root() . '/uploads';
    if (!is_dir($path) && !mkdir($path, 0777, true) && !is_dir($path)) {
        throw new ApiError('Kan geen uploadmap aanmaken op de server.', 500);
    }
    return $path;
}

function session_path(string $code): string
{
    return store_root() . '/' . $code . '.json';
}

function lock_path(string $code): string
{
    return store_root() . '/' . $code . '.lock';
}

function derive_code(string $uniqueId, int $attempt = 0): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $hash = hash('sha256', $uniqueId . ':' . $attempt, true);
    $code = '';

    for ($index = 0; $index < 5; $index += 1) {
        $byte = ord($hash[$index]);
        $code .= $alphabet[$byte % strlen($alphabet)];
    }

    return $code;
}

function resolve_code_for_unique_id(string $uniqueId): string
{
    for ($attempt = 0; $attempt < 64; $attempt += 1) {
        $candidate = derive_code($uniqueId, $attempt);
        $existing = load_session($candidate);
        if ($existing === null || (string) ($existing['uniqueId'] ?? '') === $uniqueId) {
            return $candidate;
        }
    }

    throw new ApiError('Kon geen vrije sessiecode genereren.', 500);
}

function slugify(string $value, string $fallback = 'item'): string
{
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/i', '-', $value) ?? '';
    $value = trim($value, '-');
    return $value !== '' ? $value : $fallback;
}

function random_token(int $length = 8): string
{
    return substr(bin2hex(random_bytes((int) ceil($length / 2))), 0, $length);
}

function read_json_body(): array
{
    $raw = PHP_SAPI === 'cli' ? stream_get_contents(STDIN) : file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new ApiError('Ongeldige JSON ontvangen.');
    }
    return $decoded;
}

function load_session(string $code): ?array
{
    $path = session_path($code);
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new ApiError('Kan sessie niet lezen.', 500);
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new ApiError('Sessie-opslag is beschadigd.', 500);
    }
    return $decoded;
}

function save_session(array $session): void
{
    $path = session_path((string) $session['code']);
    $encoded = json_encode($session, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        throw new ApiError('Kan sessie niet opslaan.', 500);
    }
    if (file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) === false) {
        throw new ApiError('Kan sessie niet wegschrijven.', 500);
    }
}

function with_locked_session(string $code, bool $createIfMissing, callable $callback): array
{
    $handle = fopen(lock_path($code), 'c+');
    if ($handle === false) {
        throw new ApiError('Kan geen sessielock openen.', 500);
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            throw new ApiError('Kan sessie niet vergrendelen.', 500);
        }

        $session = load_session($code);
        if ($session === null && !$createIfMissing) {
            throw new ApiError('Sessie niet gevonden.', 404);
        }

        $result = call_user_func_array($callback, [&$session]);
        if (is_array($session)) {
            save_session($session);
        }

        flock($handle, LOCK_UN);
        fclose($handle);

        return [$session, $result];
    } catch (Throwable $exception) {
        flock($handle, LOCK_UN);
        fclose($handle);
        throw $exception;
    }
}

function list_of_strings($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $clean = [];
    foreach ($value as $item) {
        $text = trim((string) $item);
        if ($text !== '') {
            $clean[] = $text;
        }
    }
    return array_values($clean);
}

function normalize_config(array $config): array
{
    $teamSize = is_array($config['teamSize'] ?? null) ? $config['teamSize'] : [];
    $teamMin = max(2, (int) ($teamSize['min'] ?? 3));
    $teamMax = max($teamMin, (int) ($teamSize['max'] ?? 4));

    $roundsMode = (string) ($config['roundsMode'] ?? 'all-roles-once');
    $validRoundModes = ['all-roles-once', '1x', '2x', '3x', '4x', '5x', '6x', '7x'];
    if (!in_array($roundsMode, $validRoundModes, true)) {
        $roundsMode = 'all-roles-once';
    }

    $roles = [];
    $seenKeys = [];
    foreach ((array) ($config['roles'] ?? []) as $index => $role) {
        if (!is_array($role)) {
            continue;
        }
        $name = trim((string) ($role['name'] ?? ''));
        $instructions = list_of_strings($role['instructions'] ?? []);
        if ($name === '' || $instructions === []) {
            continue;
        }
        $baseKey = slugify($name, 'rol-' . ($index + 1));
        $key = $baseKey;
        $suffix = 2;
        while (isset($seenKeys[$key])) {
            $key = $baseKey . '-' . $suffix;
            $suffix += 1;
        }
        $seenKeys[$key] = true;
        $roles[] = [
            'key' => $key,
            'name' => $name,
            'countPerTeam' => max(1, (int) ($role['countPerTeam'] ?? 1)),
            'instructions' => $instructions,
            'audioRecording' => (bool) ($role['audioRecording'] ?? false),
            'videoRecording' => (bool) ($role['videoRecording'] ?? false),
            'alternativeInstruction' => trim((string) ($role['alternativeInstruction'] ?? '')),
        ];
    }

    $otherInstructions = list_of_strings($config['otherRoleInstructions'] ?? []);
    if ($otherInstructions === []) {
        $otherInstructions = ['Werk mee aan de oplossing en ondersteun de andere rollen waar nodig.'];
    }

    $allowedTeamColors = array_keys(team_color_themes());
    $teamColors = [];
    foreach ((array) ($config['teamColors'] ?? []) as $colorKey) {
        $normalized = trim((string) $colorKey);
        if ($normalized !== '' && in_array($normalized, $allowedTeamColors, true)) {
            $teamColors[] = $normalized;
        }
    }

    return [
        'title' => trim((string) ($config['title'] ?? 'QR team with role divide')) ?: 'QR team with role divide',
        'description' => trim((string) ($config['description'] ?? '')),
        'teamSize' => [
            'min' => $teamMin,
            'max' => $teamMax,
        ],
        'roundsMode' => $roundsMode,
        'roleTimeoutSeconds' => max(30, (int) ($config['roleTimeoutSeconds'] ?? 180)),
        'shuffleWaitSeconds' => max(5, (int) ($config['shuffleWaitSeconds'] ?? 30)),
        'enableTestUsers' => (bool) ($config['enableTestUsers'] ?? false),
        'teamNames' => list_of_strings($config['teamNames'] ?? []),
        'teamColors' => $teamColors,
        'otherRoleName' => trim((string) ($config['otherRoleName'] ?? 'Overig')) ?: 'Overig',
        'otherRoleInstructions' => $otherInstructions,
        'roles' => $roles,
    ];
}

function build_default_team_names(): array
{
    return [
        'Team Kompas',
        'Team Horizon',
        'Team Atlas',
        'Team Nova',
        'Team Echo',
        'Team Delta',
        'Team Flux',
        'Team Orbit',
        'Team Summit',
        'Team Pulse',
        'Team Scout',
        'Team Matrix',
    ];
}

function team_color_themes(): array
{
    return [
        'yellow' => ['label' => 'Geel'],
        'green' => ['label' => 'Groen'],
        'purple' => ['label' => 'Paars'],
        'orange' => ['label' => 'Oranje'],
        'pink' => ['label' => 'Roze'],
        'blue' => ['label' => 'Blauw'],
        'red' => ['label' => 'Rood'],
    ];
}

function default_team_color_keys(): array
{
    return array_keys(team_color_themes());
}

function color_key_for_team_index(array $configuredColorKeys, int $index): string
{
    $palette = $configuredColorKeys !== [] ? array_values($configuredColorKeys) : default_team_color_keys();
    return $palette[$index % count($palette)];
}

function participant_icon_choices(): array
{
    return [
        '🦊', '🐼', '🦉', '🐯', '🐧', '🦁', '🐸', '🐨', '🦋', '🐙',
        '🦄', '🐝', '🦜', '🐢', '🦖', '🐬', '🦩', '🦝', '🐿️', '🦓',
        '🐞', '🦕', '🐳', '🦚', '🐺', '🦥', '🐹', '🦔', '🐻', '🐱',
    ];
}

function test_user_name_pool(): array
{
    return [
        'Emma de Vries',
        'Noah Jansen',
        'Julia Bakker',
        'Luca Visser',
        'Mila Smit',
        'Daan Mulder',
        'Sara Meijer',
        'Finn de Boer',
        'Yara Prins',
        'Mats Kuiper',
        'Zoey Bos',
        'Sem van Dijk',
        'Nina Dekker',
        'Ties Kok',
        'Evi Jacobs',
        'Levi Willems',
        'Fenna Vermeer',
        'Ryan Brouwer',
        'Lotte Vos',
        'Jesse de Groot',
    ];
}

function next_test_user_names(array $participants, int $count = 10): array
{
    $pool = test_user_name_pool();
    $existingNames = [];
    foreach ($participants as $participant) {
        $existingNames[strtolower((string) ($participant['name'] ?? ''))] = true;
    }

    $selected = [];
    $poolIndex = 0;
    $suffix = 2;

    while (count($selected) < $count) {
        $baseName = $pool[$poolIndex % count($pool)];
        $poolIndex += 1;
        $candidate = $baseName;

        while (isset($existingNames[strtolower($candidate)])) {
            $candidate = $baseName . ' ' . $suffix;
            $suffix += 1;
        }

        $existingNames[strtolower($candidate)] = true;
        $selected[] = $candidate;
    }

    return $selected;
}

function pick_random_participant_icon(array $participants): string
{
    $choices = participant_icon_choices();
    $usedIcons = [];
    foreach ($participants as $participant) {
        $icon = trim((string) ($participant['icon'] ?? ''));
        if ($icon !== '') {
            $usedIcons[$icon] = true;
        }
    }

    $available = array_values(array_filter($choices, static fn (string $icon): bool => !isset($usedIcons[$icon])));
    $pool = $available !== [] ? $available : $choices;
    return $pool[random_int(0, count($pool) - 1)];
}

function ensure_participant_icons(array &$session): void
{
    foreach ($session['participants'] as &$participant) {
        if (trim((string) ($participant['icon'] ?? '')) === '') {
            $participant['icon'] = pick_random_participant_icon($session['participants']);
        }
    }
    unset($participant);
}

function shuffle_copy(array $items): array
{
    $copy = array_values($items);
    for ($i = count($copy) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$copy[$i], $copy[$j]] = [$copy[$j], $copy[$i]];
    }
    return $copy;
}

function capture_mode_for_role(array $role): ?string
{
    if (!empty($role['videoRecording'])) {
        return 'video';
    }
    if (!empty($role['audioRecording'])) {
        return 'audio';
    }
    return null;
}

function role_definitions(array $config): array
{
    $roleDefs = [];
    foreach ($config['roles'] as $role) {
        $roleDefs[$role['key']] = [
            'key' => $role['key'],
            'name' => $role['name'],
            'instructions' => $role['instructions'],
            'captureMode' => capture_mode_for_role($role),
            'alternativeInstruction' => $role['alternativeInstruction'],
        ];
    }

    $roleDefs['overig'] = [
        'key' => 'overig',
        'name' => $config['otherRoleName'],
        'instructions' => $config['otherRoleInstructions'],
        'captureMode' => null,
        'alternativeInstruction' => '',
    ];

    return $roleDefs;
}

function total_rounds(array $config): int
{
    if ($config['roundsMode'] === 'all-roles-once') {
        return max(1, count($config['roles']) + 1);
    }
    return max(1, (int) rtrim($config['roundsMode'], 'x'));
}

function team_count_for_participants(int $participantCount, int $minSize, int $maxSize): int
{
    $minTeams = (int) ceil($participantCount / $maxSize);
    $maxTeams = (int) floor($participantCount / $minSize);
    if ($participantCount < $minSize || $minTeams > $maxTeams || $maxTeams < 1) {
        throw new ApiError("Met {$participantCount} deelnemers is de gekozen teamgrootte ({$minSize}-{$maxSize}) niet haalbaar.");
    }
    return max(1, $minTeams);
}

function pick_instruction(array $roleDef, array $history): array
{
    $instructions = $roleDef['instructions'];
    $usageByIndex = $history['instructionUsage'][$roleDef['key']] ?? [];
    $lastIndex = $history['lastInstructionIndex'][$roleDef['key']] ?? null;
    $bestIndex = 0;
    $bestScore = PHP_INT_MAX;

    foreach ($instructions as $index => $text) {
        $usageCount = (int) ($usageByIndex[$index] ?? 0);
        $score = $usageCount * 10 + ($lastIndex === $index ? 5 : 0) + random_int(0, 3);
        if ($score < $bestScore) {
            $bestScore = $score;
            $bestIndex = $index;
        }
    }

    return [
        'index' => $bestIndex,
        'text' => $instructions[$bestIndex],
    ];
}

function generate_round_assignments(array $participantIds, array $slots, array $histories): array
{
    $bestScore = PHP_INT_MIN;
    $bestAssignment = [];

    for ($attempt = 0; $attempt < 80; $attempt += 1) {
        $shuffledParticipants = shuffle_copy($participantIds);
        $shuffledSlots = shuffle_copy($slots);
        $candidate = [];
        $score = 0;

        foreach ($shuffledParticipants as $index => $participantId) {
            $roleKey = $shuffledSlots[$index];
            $history = $histories[$participantId] ?? ['roles' => []];
            $seenRoles = $history['roles'];
            $sameRoleCount = 0;
            foreach ($seenRoles as $seenRole) {
                if ($seenRole === $roleKey) {
                    $sameRoleCount += 1;
                }
            }
            $lastRole = $seenRoles ? $seenRoles[count($seenRoles) - 1] : null;
            $candidate[$participantId] = $roleKey;
            $score += !in_array($roleKey, $seenRoles, true) ? 40 : 0;
            $score += $lastRole !== $roleKey ? 20 : -35;
            $score -= $sameRoleCount * 8;
            $score += random_int(0, 6);
        }

        if ($score > $bestScore) {
            $bestScore = $score;
            $bestAssignment = $candidate;
        }
    }

    return $bestAssignment;
}

function build_teams_and_rounds(array $session): array
{
    $config = $session['config'];
    $participants = $session['participants'];
    if ($participants === []) {
        throw new ApiError('Er zijn nog geen studenten aangemeld.');
    }

    $participantIds = array_column($participants, 'id');
    $participantCount = count($participantIds);
    $minSize = (int) $config['teamSize']['min'];
    $maxSize = (int) $config['teamSize']['max'];

    $teamCount = team_count_for_participants($participantCount, $minSize, $maxSize);
    $shuffledParticipants = shuffle_copy($participantIds);
    $baseSize = intdiv($participantCount, $teamCount);
    $remainder = $participantCount % $teamCount;
    $teamNames = array_values(array_unique(array_merge($config['teamNames'], build_default_team_names())));
    $configuredTeamColors = $config['teamColors'] ?? [];

    $teams = [];
    $offset = 0;
    for ($index = 0; $index < $teamCount; $index += 1) {
        $size = $baseSize + ($index < $remainder ? 1 : 0);
        $teamParticipantIds = array_slice($shuffledParticipants, $offset, $size);
        $offset += $size;
        $teamName = $teamNames[$index] ?? ('Team ' . chr(65 + $index));
        $colorKey = color_key_for_team_index($configuredTeamColors, $index);
        $teams[] = [
            'id' => 'team-' . ($index + 1),
            'name' => $teamName,
            'colorKey' => $colorKey,
            'participantIds' => $teamParticipantIds,
        ];
    }

    $roleDefs = role_definitions($config);
    $participantMap = [];
    foreach ($participants as $participant) {
        $participantMap[$participant['id']] = $participant;
    }

    $roundCount = total_rounds($config);
    $rounds = [];
    for ($roundIndex = 0; $roundIndex < $roundCount; $roundIndex += 1) {
        $rounds[] = [
            'index' => $roundIndex,
            'assignments' => [],
            'captureAssignments' => [],
            'consents' => [],
            'submissions' => [],
            'shakenParticipantIds' => [],
        ];
    }

    foreach ($teams as $team) {
        $teamParticipantIds = $team['participantIds'];
        $teamSize = count($teamParticipantIds);
        $slots = [];
        foreach ($config['roles'] as $role) {
            for ($count = 0; $count < (int) $role['countPerTeam']; $count += 1) {
                $slots[] = $role['key'];
            }
        }
        if (count($slots) > $teamSize) {
            throw new ApiError("De ingestelde rollen passen niet in {$team['name']}. Verlaag aantallen per rol of maak teams groter.");
        }
        while (count($slots) < $teamSize) {
            $slots[] = 'overig';
        }

        $histories = [];
        foreach ($teamParticipantIds as $participantId) {
            $histories[$participantId] = [
                'roles' => [],
                'instructionUsage' => [],
                'lastInstructionIndex' => [],
            ];
        }

        for ($roundIndex = 0; $roundIndex < $roundCount; $roundIndex += 1) {
            $assignmentMap = generate_round_assignments($teamParticipantIds, $slots, $histories);
            foreach ($assignmentMap as $participantId => $roleKey) {
                $roleDef = $roleDefs[$roleKey];
                $instruction = pick_instruction($roleDef, $histories[$participantId]);
                $captureMode = $roleDef['captureMode'];
                $captureKey = $captureMode ? "{$team['id']}--{$roleKey}--{$participantId}--r" . ($roundIndex + 1) : null;
                $rounds[$roundIndex]['assignments'][$participantId] = [
                    'teamId' => $team['id'],
                    'teamName' => $team['name'],
                    'participantId' => $participantId,
                    'participantName' => $participantMap[$participantId]['name'] ?? 'Student',
                    'roleKey' => $roleKey,
                    'roleName' => $roleDef['name'],
                    'instructions' => [$instruction['text']],
                    'instructionIndex' => $instruction['index'],
                    'captureMode' => $captureMode,
                    'captureKey' => $captureKey,
                    'alternativeInstruction' => $roleDef['alternativeInstruction'],
                ];

                if ($captureKey) {
                    $rounds[$roundIndex]['captureAssignments'][$captureKey] = [
                        'captureKey' => $captureKey,
                        'teamId' => $team['id'],
                        'teamName' => $team['name'],
                        'holderParticipantId' => $participantId,
                        'holderName' => $participantMap[$participantId]['name'] ?? 'Student',
                        'roleName' => $roleDef['name'],
                        'captureMode' => $captureMode,
                        'alternativeInstruction' => $roleDef['alternativeInstruction'],
                    ];
                    $rounds[$roundIndex]['consents'][$captureKey] = [
                        $participantId => 'approved',
                    ];
                }

                $histories[$participantId]['roles'][] = $roleKey;
                $usage = (int) ($histories[$participantId]['instructionUsage'][$roleKey][$instruction['index']] ?? 0);
                $histories[$participantId]['instructionUsage'][$roleKey][$instruction['index']] = $usage + 1;
                $histories[$participantId]['lastInstructionIndex'][$roleKey] = $instruction['index'];
            }
        }
    }

    foreach ($participants as &$participant) {
        $participant['teamId'] = null;
        $participant['teamColorKey'] = null;
        foreach ($teams as $team) {
            if (in_array($participant['id'], $team['participantIds'], true)) {
                $participant['teamId'] = $team['id'];
                $participant['teamName'] = $team['name'];
                $participant['teamColorKey'] = $team['colorKey'];
                break;
            }
        }
    }
    unset($participant);

    return [
        'participants' => $participants,
        'teams' => $teams,
        'rounds' => $rounds,
    ];
}

function refresh_session(array &$session): void
{
    ensure_participant_icons($session);
    $now = now_ms();
    if ($session['stage'] === 'round_running' && !empty($session['timing']['roundEndsAtMs']) && $now >= (int) $session['timing']['roundEndsAtMs']) {
        $session['stage'] = 'round_wait';
        $session['timing']['waitEndsAtMs'] = $now + ((int) $session['config']['shuffleWaitSeconds'] * 1000);
        $session['timing']['roundEndedAtMs'] = $now;
        $session['updatedAtMs'] = $now;
    }

    if ($session['stage'] === 'round_wait' && !empty($session['timing']['waitEndsAtMs']) && $now >= (int) $session['timing']['waitEndsAtMs']) {
        if (($session['currentRoundIndex'] + 1) < count($session['rounds'])) {
            $session['currentRoundIndex'] += 1;
            $session['stage'] = 'round_running';
            $session['timing']['roundStartedAtMs'] = $now;
            $session['timing']['roundEndsAtMs'] = $now + ((int) $session['config']['roleTimeoutSeconds'] * 1000);
            $session['timing']['waitEndsAtMs'] = null;
            $session['updatedAtMs'] = $now;
        } else {
            $session['stage'] = 'finished';
            $session['timing']['waitEndsAtMs'] = null;
            $session['timing']['finishedAtMs'] = $now;
            $session['updatedAtMs'] = $now;
        }
    }
}

function current_round(array $session): ?array
{
    if ($session['rounds'] === []) {
        return null;
    }
    $index = (int) min(max(0, (int) $session['currentRoundIndex']), count($session['rounds']) - 1);
    return $session['rounds'][$index];
}

function preview_round(array $session): ?array
{
    if ($session['rounds'] === []) {
        return null;
    }
    if (in_array($session['stage'], ['lobby', 'teams'], true)) {
        return $session['rounds'][0];
    }
    return current_round($session);
}

function capture_summary(array $round, array $captureAssignment, array $teamParticipantIds): array
{
    $captureKey = $captureAssignment['captureKey'];
    $consents = $round['consents'][$captureKey] ?? [];
    $submitted = isset($round['submissions'][$captureKey]);
    $declined = false;
    $approvedCount = 0;

    foreach ($teamParticipantIds as $participantId) {
        $status = $consents[$participantId] ?? null;
        if ($status === 'declined') {
            $declined = true;
        }
        if ($status === 'approved') {
            $approvedCount += 1;
        }
    }

    return [
        'submitted' => $submitted,
        'anyDeclined' => $declined,
        'allApproved' => !$declined && $approvedCount === count($teamParticipantIds),
        'pendingCount' => max(0, count($teamParticipantIds) - $approvedCount),
        'consents' => $consents,
    ];
}

function public_session(array $session, ?string $participantId = null): array
{
    $participants = $session['participants'];
    $participantMap = [];
    foreach ($participants as $participant) {
        $participantMap[$participant['id']] = $participant;
    }

    $teams = $session['teams'];
    $teamMap = [];
    foreach ($teams as $team) {
        $teamMap[$team['id']] = $team;
    }

    $displayRound = preview_round($session);
    $activeRound = current_round($session);
    $currentRoundNumber = $session['rounds'] ? ((int) $session['currentRoundIndex'] + 1) : 1;
    $totalRounds = $session['rounds'] ? count($session['rounds']) : total_rounds($session['config']);

    $teamPayload = [];
    foreach ($teams as $team) {
        $members = [];
        foreach ($team['participantIds'] as $memberId) {
            $member = $participantMap[$memberId] ?? null;
            if ($member === null) {
                continue;
            }

            $assignment = $displayRound['assignments'][$memberId] ?? null;
            $captureSubmitted = false;
            $captureAlternative = false;
            if (
                $activeRound &&
                $assignment &&
                !empty($assignment['captureKey']) &&
                isset($activeRound['captureAssignments'][$assignment['captureKey']])
            ) {
                $summary = capture_summary($activeRound, $activeRound['captureAssignments'][$assignment['captureKey']], $team['participantIds']);
                $captureSubmitted = $summary['submitted'];
                $captureAlternative = $summary['anyDeclined'];
            }

            $members[] = [
                'id' => $member['id'],
                'icon' => $member['icon'] ?? '',
                'name' => $member['name'],
                'ready' => (bool) ($member['ready'] ?? false),
                'roleName' => $assignment['roleName'] ?? null,
                'captureMode' => $assignment['captureMode'] ?? null,
                'captureSubmitted' => $captureSubmitted,
                'captureAlternative' => $captureAlternative,
            ];
        }

        $teamPayload[] = [
            'id' => $team['id'],
            'name' => $team['name'],
            'colorKey' => $team['colorKey'] ?? color_key_for_team_index($session['config']['teamColors'] ?? [], count($teamPayload)),
            'members' => $members,
        ];
    }

    $participantPayload = [];
    foreach ($participants as $participant) {
        $participantPayload[] = [
            'id' => $participant['id'],
            'icon' => $participant['icon'] ?? '',
            'name' => $participant['name'],
            'ready' => (bool) ($participant['ready'] ?? false),
            'teamId' => $participant['teamId'] ?? null,
            'teamName' => $participant['teamName'] ?? null,
            'teamColorKey' => $participant['teamColorKey'] ?? null,
        ];
    }

    $me = null;
    $myTeam = null;
    $myAssignment = null;
    $teamCaptureTasks = [];
    if ($participantId !== null && isset($participantMap[$participantId])) {
        $meParticipant = $participantMap[$participantId];
        $me = [
            'id' => $meParticipant['id'],
            'icon' => $meParticipant['icon'] ?? '',
            'name' => $meParticipant['name'],
            'ready' => (bool) ($meParticipant['ready'] ?? false),
            'teamId' => $meParticipant['teamId'] ?? null,
            'teamName' => $meParticipant['teamName'] ?? null,
            'teamColorKey' => $meParticipant['teamColorKey'] ?? null,
            'hasShaken' => $activeRound ? in_array($participantId, $activeRound['shakenParticipantIds'], true) : false,
        ];

        $teamId = $meParticipant['teamId'] ?? null;
        if ($teamId && isset($teamMap[$teamId])) {
            foreach ($teamPayload as $candidateTeam) {
                if ($candidateTeam['id'] === $teamId) {
                    $myTeam = $candidateTeam;
                    break;
                }
            }
        }

        if (in_array($session['stage'], ['round_running', 'round_wait', 'finished'], true) && $activeRound && isset($activeRound['assignments'][$participantId])) {
            $assignment = $activeRound['assignments'][$participantId];
            $myAssignment = [
                'roleName' => $assignment['roleName'],
                'instructions' => $assignment['instructions'],
                'captureMode' => $assignment['captureMode'],
                'captureKey' => $assignment['captureKey'],
                'alternativeInstruction' => $assignment['alternativeInstruction'],
                'captureBlocked' => false,
            ];
        }

        if (in_array($session['stage'], ['round_running', 'round_wait', 'finished'], true) && $activeRound && $myTeam) {
            foreach ($activeRound['captureAssignments'] as $captureAssignment) {
                if ($captureAssignment['teamId'] !== $myTeam['id']) {
                    continue;
                }
                $summary = capture_summary($activeRound, $captureAssignment, $teamMap[$myTeam['id']]['participantIds']);
                $teamCaptureTasks[] = [
                    'captureKey' => $captureAssignment['captureKey'],
                    'roleName' => $captureAssignment['roleName'],
                    'holderParticipantId' => $captureAssignment['holderParticipantId'],
                    'holderIcon' => $participantMap[$captureAssignment['holderParticipantId']]['icon'] ?? '',
                    'holderName' => $captureAssignment['holderName'],
                    'captureMode' => $captureAssignment['captureMode'],
                    'myConsent' => $summary['consents'][$participantId] ?? null,
                    'allApproved' => $summary['allApproved'],
                    'anyDeclined' => $summary['anyDeclined'],
                    'pendingCount' => $summary['pendingCount'],
                    'submitted' => $summary['submitted'],
                    'isHolder' => $captureAssignment['holderParticipantId'] === $participantId,
                    'alternativeInstruction' => $captureAssignment['alternativeInstruction'],
                ];
                if ($myAssignment && $myAssignment['captureKey'] === $captureAssignment['captureKey']) {
                    $myAssignment['captureBlocked'] = $summary['anyDeclined'];
                }
            }
        }
    }

    return [
        'code' => $session['code'],
        'title' => $session['title'],
        'description' => $session['description'],
        'stage' => $session['stage'],
        'participantCount' => count($participants),
        'enableTestUsers' => (bool) ($session['config']['enableTestUsers'] ?? false),
        'teamPalette' => $session['config']['teamColors'] !== [] ? array_values($session['config']['teamColors']) : default_team_color_keys(),
        'participants' => $participantPayload,
        'teams' => $teamPayload,
        'totalRounds' => $totalRounds,
        'currentRoundNumber' => min($currentRoundNumber, $totalRounds),
        'timing' => $session['timing'],
        'me' => $me,
        'myTeam' => $myTeam,
        'myAssignment' => $myAssignment,
        'teamCaptureTasks' => $teamCaptureTasks,
    ];
}

try {
    $action = (string) ($_GET['action'] ?? '');
    if ($action === '') {
        throw new ApiError('Geen actie opgegeven.');
    }

    if ($action === 'init_screen') {
        $body = read_json_body();
        $uniqueId = trim((string) ($body['uniqueId'] ?? ''));
        if ($uniqueId === '') {
            throw new ApiError('uniqueId is verplicht.');
        }
        $config = normalize_config(is_array($body['config'] ?? null) ? $body['config'] : []);
        $code = resolve_code_for_unique_id($uniqueId);

        [$session] = with_locked_session($code, true, function (&$session) use ($uniqueId, $config, $code): bool {
            if (!is_array($session)) {
                $now = now_ms();
                $session = [
                    'code' => $code,
                    'uniqueId' => $uniqueId,
                    'config' => $config,
                    'title' => $config['title'],
                    'description' => $config['description'],
                    'stage' => 'lobby',
                    'participants' => [],
                    'teams' => [],
                    'rounds' => [],
                    'currentRoundIndex' => 0,
                    'timing' => [],
                    'createdAtMs' => $now,
                    'updatedAtMs' => $now,
                ];
                return true;
            }

            $session['config'] = $config;
            $session['title'] = $config['title'];
            $session['description'] = $config['description'];
            $session['updatedAtMs'] = now_ms();
            return true;
        });

        refresh_session($session);
        save_session($session);

        respond_json([
            'ok' => true,
            'session' => public_session($session),
        ]);
    }

    if ($action === 'state') {
        $code = strtoupper(trim((string) ($_GET['session'] ?? '')));
        $participantId = trim((string) ($_GET['participantId'] ?? '')) ?: null;

        [$session] = with_locked_session($code, false, function (&$session): bool {
            refresh_session($session);
            return true;
        });

        respond_json([
            'ok' => true,
            'session' => public_session($session, $participantId),
        ]);
    }

    if ($action === 'join') {
        $body = read_json_body();
        $code = strtoupper(trim((string) ($body['sessionCode'] ?? '')));
        $name = trim((string) ($body['name'] ?? ''));
        $participantId = trim((string) ($body['participantId'] ?? ''));
        if ($name === '') {
            throw new ApiError('Naam is verplicht.');
        }

        [$session, $resolvedParticipantId] = with_locked_session($code, false, function (&$session) use ($name, $participantId): string {
            refresh_session($session);
            if ($session['stage'] !== 'lobby') {
                throw new ApiError('Aanmelden kan alleen voordat de teams zijn ingedeeld.');
            }

            $foundIndex = null;
            if ($participantId !== '') {
                foreach ($session['participants'] as $index => $participant) {
                    if ($participant['id'] === $participantId) {
                        $foundIndex = $index;
                        break;
                    }
                }
            }

            if ($foundIndex !== null) {
                $session['participants'][$foundIndex]['name'] = $name;
                $session['updatedAtMs'] = now_ms();
                return (string) $session['participants'][$foundIndex]['id'];
            }

            $newParticipantId = random_token(10);
            $session['participants'][] = [
                'id' => $newParticipantId,
                'icon' => pick_random_participant_icon($session['participants']),
                'name' => $name,
                'ready' => false,
                'teamId' => null,
                'teamName' => null,
                'joinedAtMs' => now_ms(),
            ];
            $session['updatedAtMs'] = now_ms();
            return $newParticipantId;
        });

        respond_json([
            'ok' => true,
            'participantId' => $resolvedParticipantId,
            'session' => public_session($session, $resolvedParticipantId),
        ]);
    }

    if ($action === 'assign_teams') {
        $body = read_json_body();
        $code = strtoupper(trim((string) ($body['sessionCode'] ?? '')));

        [$session] = with_locked_session($code, false, function (&$session): bool {
            refresh_session($session);
            if (in_array($session['stage'], ['round_running', 'round_wait'], true)) {
                throw new ApiError('Teams kunnen niet opnieuw worden ingedeeld terwijl een ronde loopt.');
            }

            $built = build_teams_and_rounds($session);
            $session['participants'] = $built['participants'];
            $session['teams'] = $built['teams'];
            $session['rounds'] = $built['rounds'];
            $session['currentRoundIndex'] = 0;
            $session['stage'] = 'teams';
            $session['timing'] = [];
            $session['updatedAtMs'] = now_ms();
            return true;
        });

        respond_json([
            'ok' => true,
            'session' => public_session($session),
        ]);
    }

    if ($action === 'generate_test_users') {
        $body = read_json_body();
        $code = strtoupper(trim((string) ($body['sessionCode'] ?? '')));

        [$session] = with_locked_session($code, false, function (&$session): bool {
            refresh_session($session);
            if (empty($session['config']['enableTestUsers'])) {
                throw new ApiError('Testgebruikers genereren is niet ingeschakeld in deze configuratie.');
            }
            if ($session['stage'] !== 'lobby') {
                throw new ApiError('Testgebruikers kunnen alleen worden toegevoegd voordat teams zijn ingedeeld.');
            }

            foreach (next_test_user_names($session['participants'], 10) as $name) {
                $session['participants'][] = [
                    'id' => random_token(10),
                    'icon' => pick_random_participant_icon($session['participants']),
                    'name' => $name,
                    'ready' => false,
                    'teamId' => null,
                    'teamName' => null,
                    'teamColorKey' => null,
                    'joinedAtMs' => now_ms(),
                ];
            }

            $session['updatedAtMs'] = now_ms();
            return true;
        });

        respond_json([
            'ok' => true,
            'session' => public_session($session),
        ]);
    }

    if ($action === 'teacher_start') {
        $body = read_json_body();
        $code = strtoupper(trim((string) ($body['sessionCode'] ?? '')));

        [$session] = with_locked_session($code, false, function (&$session): bool {
            refresh_session($session);
            if ($session['stage'] !== 'teams') {
                throw new ApiError('De docent kan pas starten nadat teams zijn ingedeeld.');
            }
            if ($session['rounds'] === []) {
                throw new ApiError('Er zijn nog geen rondes voorbereid.');
            }
            $now = now_ms();
            $session['stage'] = 'round_running';
            $session['currentRoundIndex'] = 0;
            $session['timing'] = [
                'roundStartedAtMs' => $now,
                'roundEndsAtMs' => $now + ((int) $session['config']['roleTimeoutSeconds'] * 1000),
                'waitEndsAtMs' => null,
            ];
            $session['updatedAtMs'] = $now;
            return true;
        });

        respond_json([
            'ok' => true,
            'session' => public_session($session),
        ]);
    }

    if ($action === 'mobile_ready') {
        $body = read_json_body();
        $code = strtoupper(trim((string) ($body['sessionCode'] ?? '')));
        $participantId = trim((string) ($body['participantId'] ?? ''));

        [$session] = with_locked_session($code, false, function (&$session) use ($participantId): bool {
            refresh_session($session);
            foreach ($session['participants'] as &$participant) {
                if ($participant['id'] === $participantId) {
                    $participant['ready'] = true;
                    $session['updatedAtMs'] = now_ms();
                    return true;
                }
            }
            unset($participant);
            throw new ApiError('Student niet gevonden.');
        });

        respond_json([
            'ok' => true,
            'session' => public_session($session, $participantId),
        ]);
    }

    if ($action === 'set_consent') {
        $body = read_json_body();
        $code = strtoupper(trim((string) ($body['sessionCode'] ?? '')));
        $participantId = trim((string) ($body['participantId'] ?? ''));
        $captureKey = trim((string) ($body['captureKey'] ?? ''));
        $approved = (bool) ($body['approved'] ?? false);

        [$session] = with_locked_session($code, false, function (&$session) use ($participantId, $captureKey, $approved): bool {
            refresh_session($session);
            if (!in_array($session['stage'], ['round_running', 'round_wait'], true)) {
                throw new ApiError('Toestemming geven kan alleen tijdens een actieve ronde.');
            }

            $roundIndex = (int) $session['currentRoundIndex'];
            if (!isset($session['rounds'][$roundIndex]['captureAssignments'][$captureKey])) {
                throw new ApiError('Opdracht voor opname niet gevonden.');
            }

            $teamId = $session['rounds'][$roundIndex]['captureAssignments'][$captureKey]['teamId'];
            $teamParticipantIds = [];
            foreach ($session['teams'] as $team) {
                if ($team['id'] === $teamId) {
                    $teamParticipantIds = $team['participantIds'];
                    break;
                }
            }
            if (!in_array($participantId, $teamParticipantIds, true)) {
                throw new ApiError('Je hoort niet bij dit team.');
            }

            $session['rounds'][$roundIndex]['consents'][$captureKey][$participantId] = $approved ? 'approved' : 'declined';
            $session['updatedAtMs'] = now_ms();
            return true;
        });

        respond_json([
            'ok' => true,
            'session' => public_session($session, $participantId),
        ]);
    }

    if ($action === 'shake') {
        $body = read_json_body();
        $code = strtoupper(trim((string) ($body['sessionCode'] ?? '')));
        $participantId = trim((string) ($body['participantId'] ?? ''));

        [$session] = with_locked_session($code, false, function (&$session) use ($participantId): bool {
            refresh_session($session);
            if ($session['stage'] !== 'round_wait') {
                throw new ApiError('Schudden kan pas zodra de tijd op is.');
            }
            $roundIndex = (int) $session['currentRoundIndex'];
            if (!in_array($participantId, $session['rounds'][$roundIndex]['shakenParticipantIds'], true)) {
                $session['rounds'][$roundIndex]['shakenParticipantIds'][] = $participantId;
                $session['updatedAtMs'] = now_ms();
            }
            return true;
        });

        respond_json([
            'ok' => true,
            'session' => public_session($session, $participantId),
        ]);
    }

    if ($action === 'upload_capture') {
        $code = strtoupper(trim((string) ($_POST['sessionCode'] ?? '')));
        $participantId = trim((string) ($_POST['participantId'] ?? ''));
        $captureKey = trim((string) ($_POST['captureKey'] ?? ''));
        $file = $_FILES['media'] ?? null;
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new ApiError('Geen opnamebestand ontvangen.');
        }

        [$session] = with_locked_session($code, false, function (&$session) use ($participantId, $captureKey, $file): bool {
            refresh_session($session);
            if ($session['stage'] !== 'round_running') {
                throw new ApiError('Opnames kunnen alleen tijdens een actieve ronde worden ingeleverd.');
            }

            $roundIndex = (int) $session['currentRoundIndex'];
            $round = $session['rounds'][$roundIndex];
            $captureAssignment = $round['captureAssignments'][$captureKey] ?? null;
            if (!$captureAssignment) {
                throw new ApiError('Opname-opdracht niet gevonden.');
            }
            if ($captureAssignment['holderParticipantId'] !== $participantId) {
                throw new ApiError('Alleen de aangewezen student mag deze opname uploaden.');
            }

            $teamParticipantIds = [];
            foreach ($session['teams'] as $team) {
                if ($team['id'] === $captureAssignment['teamId']) {
                    $teamParticipantIds = $team['participantIds'];
                    break;
                }
            }
            $summary = capture_summary($round, $captureAssignment, $teamParticipantIds);
            if ($summary['anyDeclined']) {
                throw new ApiError('Deze opname is geblokkeerd omdat niet iedereen akkoord is.');
            }
            if (!$summary['allApproved']) {
                throw new ApiError('Nog niet iedereen in het team heeft akkoord gegeven.');
            }

            $uploadDir = uploads_root() . '/' . $code;
            if (!is_dir($uploadDir) && !mkdir($uploadDir, 0777, true) && !is_dir($uploadDir)) {
                throw new ApiError('Kan uploadmap niet aanmaken.', 500);
            }
            $extension = pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION);
            $safeExtension = $extension !== '' ? '.' . slugify($extension, 'bin') : '.bin';
            $targetName = $captureKey . '--' . $participantId . $safeExtension;
            $targetPath = $uploadDir . '/' . $targetName;
            if (!move_uploaded_file((string) $file['tmp_name'], $targetPath)) {
                throw new ApiError('Upload kon niet worden opgeslagen.', 500);
            }

            $session['rounds'][$roundIndex]['submissions'][$captureKey] = [
                'participantId' => $participantId,
                'fileName' => $targetName,
                'uploadedAtMs' => now_ms(),
            ];
            $session['updatedAtMs'] = now_ms();
            return true;
        });

        respond_json([
            'ok' => true,
            'session' => public_session($session, $participantId),
        ]);
    }

    throw new ApiError('Onbekende actie.', 404);
} catch (ApiError $error) {
    respond_json([
        'ok' => false,
        'error' => $error->getMessage(),
    ], $error->status);
} catch (Throwable $error) {
    respond_json([
        'ok' => false,
        'error' => 'Interne fout: ' . $error->getMessage(),
    ], 500);
}
