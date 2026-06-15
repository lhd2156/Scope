from __future__ import annotations

from uuid import UUID

from django.conf import settings

try:
    import requests
except ImportError:  # pragma: no cover - requests is installed in runtime images
    requests = None


SHOWCASE_USER_PROFILES = {
    '11111111111111111111111111111111': {
        'username': 'alex.morgan',
        'email': '',
        'displayName': 'Alex Morgan',
        'avatarUrl': 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter persona for food-first city routes, late dinners, and walkable culture loops.',
        'homeBase': 'Fort Worth, TX',
        'interests': ['food', 'culture', 'nightlife'],
    },
    '22222222222222222222222222222222': {
        'username': 'maya.chen',
        'email': '',
        'displayName': 'Maya Chen',
        'avatarUrl': 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for gardens, museums, and design-forward weekend pacing.',
        'homeBase': 'Dallas, TX',
        'interests': ['scenic', 'culture', 'shopping'],
    },
    '33333333333333333333333333333333': {
        'username': 'elijah.brooks',
        'email': '',
        'displayName': 'Elijah Brooks',
        'avatarUrl': 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for outdoor resets, strong coffee, and high-energy city walks.',
        'homeBase': 'Austin, TX',
        'interests': ['adventure', 'food', 'nature'],
    },
    '44444444444444444444444444444441': {
        'username': 'sofia.ramirez',
        'email': '',
        'displayName': 'Sofia Ramirez',
        'avatarUrl': 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for market mornings, heritage districts, and food-led itineraries.',
        'homeBase': 'San Antonio, TX',
        'interests': ['food', 'culture', 'shopping'],
    },
    '55555555555555555555555555555551': {
        'username': 'jordan.reed',
        'email': '',
        'displayName': 'Jordan Reed',
        'avatarUrl': 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for scenic overlooks, rail stations, and daylight-efficient routes.',
        'homeBase': 'Denver, CO',
        'interests': ['scenic', 'nature', 'adventure'],
    },
    '66666666666666666666666666666661': {
        'username': 'aisha.bello',
        'email': '',
        'displayName': 'Aisha Bello',
        'avatarUrl': 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for waterfront walks, art districts, and polished group dinners.',
        'homeBase': 'Houston, TX',
        'interests': ['culture', 'food', 'scenic'],
    },
    '77777777777777777777777777777771': {
        'username': 'theo.alvarez',
        'email': '',
        'displayName': 'Theo Alvarez',
        'avatarUrl': 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for markets, architecture, and late-night city energy.',
        'homeBase': 'Barcelona, ES',
        'interests': ['culture', 'shopping', 'nightlife'],
    },
    '88888888888888888888888888888881': {
        'username': 'priya.nair',
        'email': '',
        'displayName': 'Priya Nair',
        'avatarUrl': 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for gardens, skyline walks, and compact international stopovers.',
        'homeBase': 'Singapore',
        'interests': ['scenic', 'culture', 'food'],
    },
    '99999999999999999999999999999991': {
        'username': 'camille.laurent',
        'email': '',
        'displayName': 'Camille Laurent',
        'avatarUrl': 'https://images.pexels.com/photos/697509/pexels-photo-697509.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for museum mornings, city walks, and design-forward neighborhoods.',
        'homeBase': 'Paris, FR',
        'interests': ['culture', 'shopping', 'scenic'],
    },
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1': {
        'username': 'noah.kim',
        'email': '',
        'displayName': 'Noah Kim',
        'avatarUrl': 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for mountain gateways, waterfront walks, and low-friction outdoor days.',
        'homeBase': 'Vancouver, CA',
        'interests': ['nature', 'adventure', 'scenic'],
    },
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1': {
        'username': 'luca.moretti',
        'email': '',
        'displayName': 'Luca Moretti',
        'avatarUrl': 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for rail-linked city breaks, market lunches, and late scenic walks.',
        'homeBase': 'Lisbon, PT',
        'interests': ['scenic', 'food', 'nightlife'],
    },
    'ccccccccccccccccccccccccccccccc1': {
        'username': 'harper.singh',
        'email': '',
        'displayName': 'Harper Singh',
        'avatarUrl': 'https://images.pexels.com/photos/3763188/pexels-photo-3763188.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for national parks, gear-light adventures, and efficient road-trip stops.',
        'homeBase': 'Denver, CO',
        'interests': ['adventure', 'shopping', 'nature'],
    },
    'ddddddddddddddddddddddddddddddd1': {
        'username': 'emilia.soto',
        'email': '',
        'displayName': 'Emilia Soto',
        'avatarUrl': 'https://images.pexels.com/photos/3760854/pexels-photo-3760854.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for heritage markets, neighborhood food walks, and big-city cultural anchors.',
        'homeBase': 'Buenos Aires, AR',
        'interests': ['culture', 'food', 'shopping'],
    },
    'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeee9': {
        'username': 'lena.ortiz',
        'email': '',
        'displayName': 'Lena Ortiz',
        'avatarUrl': 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for desert color, gallery blocks, and warm-weather weekend pacing.',
        'homeBase': 'Phoenix, AZ',
        'interests': ['scenic', 'shopping', 'culture'],
    },
    'fffffffffffffffffffffffffffffff9': {
        'username': 'marcus.grant',
        'email': '',
        'displayName': 'Marcus Grant',
        'avatarUrl': 'https://images.pexels.com/photos/3775534/pexels-photo-3775534.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for live music, food halls, historic streets, and energetic group nights.',
        'homeBase': 'Nashville, TN',
        'interests': ['nightlife', 'food', 'culture'],
    },
    'ababababababababababababababab01': {
        'username': 'nia.okafor',
        'email': '',
        'displayName': 'Nia Okafor',
        'avatarUrl': 'https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for public art, civic parks, and culture-first urban routes.',
        'homeBase': 'Atlanta, GA',
        'interests': ['culture', 'scenic', 'food'],
    },
    'bcbcbcbcbcbcbcbcbcbcbcbcbcbcbc01': {
        'username': 'owen.park',
        'email': '',
        'displayName': 'Owen Park',
        'avatarUrl': 'https://images.pexels.com/photos/3762800/pexels-photo-3762800.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for coastal trails, markets, coffee stops, and weather-aware scenic days.',
        'homeBase': 'Seattle, WA',
        'interests': ['nature', 'scenic', 'food'],
    },
    'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcd01': {
        'username': 'clara.jensen',
        'email': '',
        'displayName': 'Clara Jensen',
        'avatarUrl': 'https://images.pexels.com/photos/3824771/pexels-photo-3824771.jpeg?auto=compress&cs=tinysrgb&w=600',
        'bio': 'Fictional Scope starter profile for riverfront paths, museums, and relaxed city-to-nature weekends.',
        'homeBase': 'Minneapolis, MN',
        'interests': ['culture', 'nature', 'scenic'],
    },
}

ANONYMOUS_USER_PROFILE = {
    'id': 'anonymous',
    'username': 'anonymous',
    'email': '',
    'displayName': 'Anonymous traveler',
    'avatarUrl': '',
    'bio': '',
    'homeBase': '',
    'interests': [],
    'showActivityStatus': False,
    'profileVisibility': 'private',
    'stats': {'spots': 0, 'trips': 0, 'friends': 0},
}


def normalize_user_key(value) -> str:
    try:
        return UUID(str(value)).hex
    except (TypeError, ValueError, AttributeError):
        try:
            return UUID(hex=str(value)).hex
        except (TypeError, ValueError, AttributeError):
            return str(value or '').replace('-', '').lower()


def anonymous_user_profile() -> dict:
    return ANONYMOUS_USER_PROFILE.copy()


def default_user_profile(user_id) -> dict:
    key = normalize_user_key(user_id)
    showcase_profile = SHOWCASE_USER_PROFILES.get(key, {})
    username = showcase_profile.get('username') or f'traveler-{key[:8] or "scope"}'
    display_name = showcase_profile.get('displayName') or f'Traveler {key[:8] or "Scope"}'
    return {
        'id': str(user_id),
        'username': username,
        'email': showcase_profile.get('email', ''),
        'displayName': display_name,
        'avatarUrl': showcase_profile.get('avatarUrl', ''),
        'bio': showcase_profile.get('bio', ''),
        'homeBase': showcase_profile.get('homeBase', ''),
        'interests': showcase_profile.get('interests', []),
        'showActivityStatus': True,
        'profileVisibility': 'public' if showcase_profile else 'private',
        'stats': {'spots': 18, 'trips': 5, 'friends': 96} if showcase_profile else {'spots': 0, 'trips': 0, 'friends': 0},
    }


def _request_cache(request) -> dict[str, dict] | None:
    if request is None:
        return None
    cache = getattr(request, '_scope_user_profile_cache', None)
    if cache is None:
        cache = {}
        setattr(request, '_scope_user_profile_cache', cache)
    return cache


def _auth_header(request) -> str:
    if request is None:
        return ''
    return str(getattr(request, 'headers', {}).get('Authorization', '') or '')


def _coerce_core_profile(user_id, payload: dict) -> dict | None:
    raw = payload.get('data') if isinstance(payload.get('data'), dict) else payload
    if not isinstance(raw, dict):
        return None
    display_name = raw.get('displayName') or raw.get('DisplayName')
    username = raw.get('username') or raw.get('Username')
    if not display_name and not username:
        return None
    stats = raw.get('stats') or raw.get('Stats') or {}
    return {
        'id': str(raw.get('id') or raw.get('Id') or user_id),
        'username': str(username or '').strip() or f'traveler-{normalize_user_key(user_id)[:8]}',
        'email': str(raw.get('email') or raw.get('Email') or ''),
        'displayName': str(display_name or username).strip(),
        'avatarUrl': str(raw.get('avatarUrl') or raw.get('AvatarUrl') or ''),
        'bio': raw.get('bio') or raw.get('Bio') or '',
        'homeBase': raw.get('homeBase') or raw.get('HomeBase') or '',
        'interests': raw.get('interests') or raw.get('Interests') or [],
        'showActivityStatus': bool(raw.get('showActivityStatus') if 'showActivityStatus' in raw else raw.get('ShowActivityStatus', True)),
        'profileVisibility': str(raw.get('profileVisibility') or raw.get('ProfileVisibility') or 'private'),
        'stats': {
            'spots': int(stats.get('spots') or stats.get('Spots') or 0) if isinstance(stats, dict) else 0,
            'trips': int(stats.get('trips') or stats.get('Trips') or 0) if isinstance(stats, dict) else 0,
            'friends': int(stats.get('friends') or stats.get('Friends') or 0) if isinstance(stats, dict) else 0,
        },
    }


def _fetch_core_user_profile(user_id, request=None) -> dict | None:
    base_url = str(getattr(settings, 'CORE_SERVICE_URL', '') or '').rstrip('/')
    authorization = _auth_header(request)
    if not base_url or not authorization or requests is None:
        return None
    try:
        parsed_user_id = str(UUID(str(user_id)))
    except (TypeError, ValueError, AttributeError):
        return None
    try:
        response = requests.get(
            f'{base_url}/api/core/users/{parsed_user_id}',
            headers={'Accept': 'application/json', 'Authorization': authorization},
            timeout=float(getattr(settings, 'CORE_PROFILE_TIMEOUT_SECONDS', 1.5)),
        )
    except requests.RequestException:
        return None
    if response.status_code >= 400:
        return None
    try:
        payload = response.json()
    except ValueError:
        return None
    return _coerce_core_profile(user_id, payload)


def resolve_user_profile(user_id, request=None) -> dict:
    key = normalize_user_key(user_id)
    cache = _request_cache(request)
    if cache is not None and key in cache:
        return cache[key].copy()

    profile = _fetch_core_user_profile(user_id, request) or default_user_profile(user_id)
    if cache is not None:
        cache[key] = profile
    return profile.copy()


def resolve_user_profiles(user_ids: set[object], request=None) -> dict[str, dict]:
    return {normalize_user_key(user_id): resolve_user_profile(user_id, request) for user_id in user_ids}
