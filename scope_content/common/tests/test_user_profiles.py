from __future__ import annotations

from types import SimpleNamespace

from django.test import override_settings

from common import user_profiles


ELIJAH_ID = '33333333-3333-3333-3333-333333333333'
ELIJAH_AVATAR = 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600'


def test_showcase_user_profile_keeps_elijah_avatar_consistent():
    profile = user_profiles.resolve_user_profile(ELIJAH_ID)

    assert profile['displayName'] == 'Elijah Brooks'
    assert profile['username'] == 'elijah.brooks'
    assert profile['avatarUrl'] == ELIJAH_AVATAR


@override_settings(CORE_SERVICE_URL='http://core:8080', CORE_PROFILE_TIMEOUT_SECONDS=0.2)
def test_resolve_user_profile_prefers_core_payload_when_authorized(monkeypatch):
    calls = []

    class Response:
        status_code = 200

        @staticmethod
        def json():
            return {
                'data': {
                    'id': 'aaaaaaaa-0000-0000-0000-000000000001',
                    'username': 'real.traveler',
                    'email': '',
                    'displayName': 'Real Traveler',
                    'avatarUrl': 'https://cdn.example/avatar.jpg',
                    'bio': 'Real public bio',
                    'homeBase': 'Austin, TX',
                    'interests': ['food'],
                    'showActivityStatus': True,
                    'profileVisibility': 'public',
                    'stats': {'spots': 2, 'trips': 1, 'friends': 3},
                },
            }

    def fake_get(url, headers, timeout):
        calls.append((url, headers, timeout))
        return Response()

    monkeypatch.setattr(user_profiles.requests, 'get', fake_get)
    request = SimpleNamespace(headers={'Authorization': 'Bearer token'})

    profile = user_profiles.resolve_user_profile('aaaaaaaa-0000-0000-0000-000000000001', request=request)

    assert profile['displayName'] == 'Real Traveler'
    assert profile['avatarUrl'] == 'https://cdn.example/avatar.jpg'
    assert profile['stats'] == {'spots': 2, 'trips': 1, 'friends': 3}
    assert calls == [
        (
            'http://core:8080/api/core/users/aaaaaaaa-0000-0000-0000-000000000001',
            {'Accept': 'application/json', 'Authorization': 'Bearer token'},
            0.2,
        ),
    ]


@override_settings(CORE_SERVICE_URL='http://core:8080')
def test_resolve_user_profile_uses_neutral_fallback_without_auth(monkeypatch):
    def fail_get(*_args, **_kwargs):
        raise AssertionError('Core should not be called without an Authorization header')

    monkeypatch.setattr(user_profiles.requests, 'get', fail_get)
    profile = user_profiles.resolve_user_profile('aaaaaaaa-0000-0000-0000-000000000099')

    assert profile['displayName'] == 'Traveler aaaaaaaa'
    assert profile['avatarUrl'] == ''
