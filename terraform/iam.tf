data "aws_iam_policy_document" "eks_cluster_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eks_cluster" {
  count              = local.deploy_eks ? 1 : 0
  name               = "${local.name_prefix}-eks-cluster-role"
  assume_role_policy = data.aws_iam_policy_document.eks_cluster_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  count      = local.deploy_eks ? 1 : 0
  role       = aws_iam_role.eks_cluster[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role_policy_attachment" "eks_cluster_vpc_policy" {
  count      = local.deploy_eks ? 1 : 0
  role       = aws_iam_role.eks_cluster[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
}

data "aws_iam_policy_document" "eks_node_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eks_node_group" {
  count              = local.deploy_eks ? 1 : 0
  name               = "${local.name_prefix}-eks-node-role"
  assume_role_policy = data.aws_iam_policy_document.eks_node_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  count      = local.deploy_eks ? 1 : 0
  role       = aws_iam_role.eks_node_group[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  count      = local.deploy_eks ? 1 : 0
  role       = aws_iam_role.eks_node_group[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "eks_ecr_read_only" {
  count      = local.deploy_eks ? 1 : 0
  role       = aws_iam_role.eks_node_group[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "eks_ssm_managed" {
  count      = local.deploy_eks ? 1 : 0
  role       = aws_iam_role.eks_node_group[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "eks_node_photos_bucket" {
  count = local.deploy_eks ? 1 : 0

  statement {
    sid = "ListScopePhotosBucket"
    actions = [
      "s3:ListBucket"
    ]
    resources = [
      aws_s3_bucket.photos.arn
    ]
  }

  statement {
    sid = "ReadWriteScopePhotosObjects"
    actions = [
      "s3:AbortMultipartUpload",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:PutObject"
    ]
    resources = [
      "${aws_s3_bucket.photos.arn}/*"
    ]
  }
}

resource "aws_iam_role_policy" "eks_node_photos_bucket" {
  count  = local.deploy_eks ? 1 : 0
  name   = "${local.name_prefix}-eks-photos-bucket"
  role   = aws_iam_role.eks_node_group[0].id
  policy = data.aws_iam_policy_document.eks_node_photos_bucket[0].json
}
