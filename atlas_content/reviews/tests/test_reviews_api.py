import pytest

from spots.models import Spot


@pytest.mark.django_db
def test_create_and_list_reviews_use_camel_case_contract(authenticated_client, spot):
    create_response = authenticated_client.post(
        f'/api/content/reviews/spot/{spot.id}',
        {'rating': 4.5, 'comment': 'Worth the detour'},
        format='json',
    )

    assert create_response.status_code == 201
    created_review = create_response.json()['data']
    assert created_review['spotId'] == str(spot.id)
    assert created_review['comment'] == 'Worth the detour'
    assert 'createdAt' in created_review

    list_response = authenticated_client.get(f'/api/content/reviews/spot/{spot.id}')

    assert list_response.status_code == 200
    assert list_response.json()['data'][0]['spotId'] == str(spot.id)


@pytest.mark.django_db
def test_private_spot_reviews_are_forbidden_for_anonymous(api_client, auth_header):
    _, user_id = auth_header
    private_spot = Spot.objects.create(
        user_id=user_id,
        title='Private Ridge',
        latitude=32.75,
        longitude=-97.33,
        category='nature',
        is_public=False,
    )

    response = api_client.get(f'/api/content/reviews/spot/{private_spot.id}')

    assert response.status_code == 403
